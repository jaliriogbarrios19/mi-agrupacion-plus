-- =============================================================================
-- RLS Test Script for Mi Agrupacion Plus
-- Run this in the Supabase SQL Editor to verify cross-vault isolation.
-- Requires: at least two test users in auth.users.
-- =============================================================================

-- ── Helper: simulate auth.uid() as a specific user ──
CREATE OR REPLACE FUNCTION test.authenticate_as(user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text)::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION test.clear_auth()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '{}', true);
END;
$$;

-- =============================================================================
-- SETUP: Create two test users and two vaults
-- =============================================================================
DO $$
DECLARE
    user_a uuid;
    user_b uuid;
    vault_a uuid;
    vault_b uuid;
    code_a text;
    test_pass boolean := true;
    result_count int;
BEGIN
    -- Create test users (skip if they already exist)
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
    VALUES
        (gen_random_uuid(), 'test-a@example.com', 'fake-hash', now()),
        (gen_random_uuid(), 'test-b@example.com', 'fake-hash', now())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO user_a;

    -- Get user IDs
    SELECT id INTO user_a FROM auth.users WHERE email = 'test-a@example.com';
    SELECT id INTO user_b FROM auth.users WHERE email = 'test-b@example.com';

    RAISE NOTICE 'User A: %', user_a;
    RAISE NOTICE 'User B: %', user_b;

    -- Clean up previous test data
    DELETE FROM notes WHERE vault_id IN (SELECT id FROM vaults WHERE name LIKE 'TEST-RLS-%');
    DELETE FROM invitations WHERE vault_id IN (SELECT id FROM vaults WHERE name LIKE 'TEST-RLS-%');
    DELETE FROM vault_members WHERE vault_id IN (SELECT id FROM vaults WHERE name LIKE 'TEST-RLS-%');
    DELETE FROM vaults WHERE name LIKE 'TEST-RLS-%';

    -- Create vaults via direct insert (bypassing RPC for test setup)
    -- We need postgres role for this
    PERFORM test.clear_auth();

    INSERT INTO vaults (id, name) VALUES (gen_random_uuid(), 'TEST-RLS-AgrupA') RETURNING id INTO vault_a;
    INSERT INTO vaults (id, name) VALUES (gen_random_uuid(), 'TEST-RLS-AgrupB') RETURNING id INTO vault_b;

    RAISE NOTICE 'Vault A: %', vault_a;
    RAISE NOTICE 'Vault B: %', vault_b;

    -- Add members: User A -> Vault A (admin), User B -> Vault B (admin)
    INSERT INTO vault_members (vault_id, user_id, role) VALUES
        (vault_a, user_a, 'admin'),
        (vault_b, user_b, 'admin');

    -- Add a note to each vault
    INSERT INTO notes (vault_id, path, content) VALUES
        (vault_a, 'Registros/test-a.md', '# Test Note from Vault A'),
        (vault_b, 'Registros/test-b.md', '# Test Note from Vault B');

    -- Create an invitation for Vault A
    code_a := 'MA-TESTAAAA';
    INSERT INTO invitations (code, vault_id) VALUES (code_a, vault_a);

    -- =========================================================================
    -- TEST 1: User A can see Vault A's notes
    -- =========================================================================
    PERFORM test.authenticate_as(user_a);

    SELECT count(*) INTO result_count FROM notes WHERE vault_id = vault_a;
    IF result_count != 1 THEN
        RAISE WARNING 'FAIL: User A should see Vault A notes (got %)', result_count;
        test_pass := false;
    ELSE
        RAISE NOTICE 'PASS: User A can see Vault A notes';
    END IF;

    -- =========================================================================
    -- TEST 2: User A CANNOT see Vault B's notes
    -- =========================================================================
    SELECT count(*) INTO result_count FROM notes WHERE vault_id = vault_b;
    IF result_count != 0 THEN
        RAISE WARNING 'FAIL: User A should NOT see Vault B notes (got %)', result_count;
        test_pass := false;
    ELSE
        RAISE NOTICE 'PASS: User A cannot see Vault B notes';
    END IF;

    -- =========================================================================
    -- TEST 3: User B can see Vault B's notes
    -- =========================================================================
    PERFORM test.authenticate_as(user_b);

    SELECT count(*) INTO result_count FROM notes WHERE vault_id = vault_b;
    IF result_count != 1 THEN
        RAISE WARNING 'FAIL: User B should see Vault B notes (got %)', result_count;
        test_pass := false;
    ELSE
        RAISE NOTICE 'PASS: User B can see Vault B notes';
    END IF;

    -- =========================================================================
    -- TEST 4: User B CANNOT see Vault A's notes
    -- =========================================================================
    SELECT count(*) INTO result_count FROM notes WHERE vault_id = vault_a;
    IF result_count != 0 THEN
        RAISE WARNING 'FAIL: User B should NOT see Vault A notes (got %)', result_count;
        test_pass := false;
    ELSE
        RAISE NOTICE 'PASS: User B cannot see Vault A notes';
    END IF;

    -- =========================================================================
    -- TEST 5: User A CANNOT insert into Vault B
    -- =========================================================================
    PERFORM test.authenticate_as(user_a);

    BEGIN
        INSERT INTO notes (vault_id, path, content) VALUES (vault_b, 'Registros/hack-a.md', 'Sneaky');
        RAISE WARNING 'FAIL: User A should NOT be able to insert into Vault B';
        test_pass := false;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS: User A blocked from inserting into Vault B';
    END;

    -- =========================================================================
    -- TEST 6: User B CANNOT update Vault A's notes
    -- =========================================================================
    PERFORM test.authenticate_as(user_b);

    UPDATE notes SET content = 'HACKED' WHERE vault_id = vault_a AND path = 'Registros/test-a.md';
    GET DIAGNOSTICS result_count = ROW_COUNT;
    IF result_count != 0 THEN
        RAISE WARNING 'FAIL: User B should NOT be able to update Vault A notes (affected % rows)', result_count;
        test_pass := false;
    ELSE
        RAISE NOTICE 'PASS: User B blocked from updating Vault A notes';
    END IF;

    -- =========================================================================
    -- TEST 7: User B CANNOT delete Vault A's notes
    -- =========================================================================
    DELETE FROM notes WHERE vault_id = vault_a AND path = 'Registros/test-a.md';
    GET DIAGNOSTICS result_count = ROW_COUNT;
    IF result_count != 0 THEN
        RAISE WARNING 'FAIL: User B should NOT be able to delete Vault A notes (deleted % rows)', result_count;
        test_pass := false;
    ELSE
        RAISE NOTICE 'PASS: User B blocked from deleting Vault A notes';
    END IF;

    -- =========================================================================
    -- TEST 8: User A CANNOT see Vault B's vault details
    -- =========================================================================
    PERFORM test.authenticate_as(user_a);

    SELECT count(*) INTO result_count FROM vaults WHERE id = vault_b;
    IF result_count != 0 THEN
        RAISE WARNING 'FAIL: User A should NOT see Vault B details (got %)', result_count;
        test_pass := false;
    ELSE
        RAISE NOTICE 'PASS: User A cannot see Vault B details';
    END IF;

    -- =========================================================================
    -- TEST 9: User A CANNOT see Vault B's members
    -- =========================================================================
    SELECT count(*) INTO result_count FROM vault_members WHERE vault_id = vault_b;
    IF result_count != 0 THEN
        RAISE WARNING 'FAIL: User A should NOT see Vault B members (got %)', result_count;
        test_pass := false;
    ELSE
        RAISE NOTICE 'PASS: User A cannot see Vault B members';
    END IF;

    -- =========================================================================
    -- TEST 10: Invitations are readable by any authenticated user
    -- =========================================================================
    SELECT count(*) INTO result_count FROM invitations WHERE code = code_a;
    IF result_count != 1 THEN
        RAISE WARNING 'FAIL: Any authenticated user should be able to read invitations (got %)', result_count;
        test_pass := false;
    ELSE
        RAISE NOTICE 'PASS: Invitations readable by any authenticated user';
    END IF;

    -- =========================================================================
    -- TEST 11: User CANNOT insert invitations directly (only via RPC)
    -- =========================================================================
    BEGIN
        INSERT INTO invitations (code, vault_id) VALUES ('MA-HACKTEST', vault_b);
        RAISE WARNING 'FAIL: Direct invitation insert should be blocked';
        test_pass := false;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS: Direct invitation insert blocked';
    END;

    -- =========================================================================
    -- TEST 12: User CANNOT insert vault_members directly (only via RPC)
    -- =========================================================================
    BEGIN
        INSERT INTO vault_members (vault_id, user_id, role) VALUES (vault_b, user_a, 'admin');
        RAISE WARNING 'FAIL: Direct vault_members insert should be blocked';
        test_pass := false;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS: Direct vault_members insert blocked';
    END;

    -- =========================================================================
    -- TEST 13: User CANNOT insert vaults directly (only via RPC)
    -- =========================================================================
    BEGIN
        INSERT INTO vaults (name) VALUES ('TEST-RLS-HackVault');
        RAISE WARNING 'FAIL: Direct vaults insert should be blocked';
        test_pass := false;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS: Direct vaults insert blocked';
    END;

    -- =========================================================================
    -- CLEANUP
    -- =========================================================================
    PERFORM test.clear_auth();
    DELETE FROM notes WHERE vault_id IN (vault_a, vault_b);
    DELETE FROM invitations WHERE vault_id IN (vault_a, vault_b);
    DELETE FROM vault_members WHERE vault_id IN (vault_a, vault_b);
    DELETE FROM vaults WHERE id IN (vault_a, vault_b);
    DELETE FROM auth.users WHERE email IN ('test-a@example.com', 'test-b@example.com');

    -- =========================================================================
    -- RESULT
    -- =========================================================================
    IF test_pass THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE 'ALL RLS TESTS PASSED ✅';
        RAISE NOTICE '========================================';
    ELSE
        RAISE WARNING '========================================';
        RAISE WARNING 'SOME RLS TESTS FAILED ❌ — review warnings above';
        RAISE WARNING '========================================';
    END IF;
END $$;

-- Cleanup helper functions
DROP FUNCTION IF EXISTS test.authenticate_as(uuid);
DROP FUNCTION IF EXISTS test.clear_auth();
