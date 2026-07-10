# AGENTS.md — Mi Agrupación Plus

## Project Overview
Obsidian plugin for Bahá'í community activity tracking with Supabase sync.
TypeScript, esbuild, Supabase REST API (PostgREST), RLS multi-tenant.

## MANDATORY: Load Skills Before Working

Before making ANY code change, load these skills in order:

1. **`obsidian-plugin`** — API rules, review compliance, gotchas
2. **`obsidian-plugin-dev`** — Workflow, release, changelog conventions
3. **`supabase-debugging`** — If touching anything in `src/supabase/`

```
skill_view(name="obsidian-plugin")
skill_view(name="obsidian-plugin-dev")
# Only if modifying Supabase code:
skill_view(name="supabase-debugging")
```

No exceptions. Even for "simple" fixes. The skills contain accumulated
knowledge about pitfalls that are NOT obvious from reading the code alone.

## Critical Rules

### Obsidian API
- **Never use `fetch()`** — use `requestUrl()` via the `api()` helper in `client.ts`
- **Never use `innerHTML`** — use `createEl()`, `createDiv()`, `createSpan()`
- **Never use `confirm()` / `window.prompt()`** — use custom Modal subclasses
- **Use `window.setTimeout()`** not bare `setTimeout()` (popout window compat)
- **Async onClick → `void (async () => { ... })()`** (must return void)
- **Always wrap vault operations in try-catch** (async index race conditions)
- **JSON.parse() results must be typed with `as`** (e.g., `res.json as MyType`)

### Supabase / PostgREST
- **Filter params MUST include `eq.` prefix** — `vault_id=eq.{id}`, not `vault_id={id}`
  - `restGet()` callers already pass `eq.` manually
  - `restInsertOrUpdate()` auto-prefixes with `eq.` (fixed 2026-07-10)
- **`requestUrl()` returns `{ status, json, text }`** — `json` and `text` are PROPERTIES, not methods
- **Log error body on non-2xx** — `res.json` contains the real error message (e.g., `22P02`, `42501`)
- **BEFORE triggers fire twice on native upsert** — use `GET→PATCH/POST` pattern instead of `on_conflict`

### File Size
- **Max ~300 lines per source file.** When approaching the limit, extract by concern.
- Current split: `client.ts` (HTTP/auth), `sync.ts` (orchestrator), `sync-push.ts` (push), `sync-pull.ts` (pull), `rpc.ts` (server functions), `rate-limiter.ts` (client limits)

### Build & Test
```bash
npm run build    # tsc -noEmit -skipLibCheck && node esbuild.config.mjs production
npm run test     # vitest run (currently no tests)
npm run dev      # node esbuild.config.mjs (watch mode)
```

## Conventions
- **Commits**: conventional — `feat:`, `fix:`, `chore:`, `docs:`
- **Tags**: NO `v` prefix (Obsidian compares exact version string)
- **Release assets**: only `main.js`, `manifest.json`, `styles.css`
- **Language**: UI text in Spanish (Rioplatense: "vos", "iniciá", "conectá")

## Architecture

```
src/
  main.ts              — Plugin entry, settings, sync lifecycle
  types.ts             — Shared types
  supabase/
    client.ts          — HTTP client, auth, REST helpers, session management
    sync.ts            — SyncManager orchestrator (pushNow, pullChanges, clearAndResync)
    sync-push.ts       — PushHandler (vault events → queue → flush to Supabase)
    sync-pull.ts       — PullHandler (Supabase → local vault)
    rpc.ts             — Server-side RPC calls (create_vault, join_vault, etc.)
    rate-limiter.ts    — Client-side rate limiting
    login-modal.ts     — Login/signup modal
  views/               — Dashboard, resumen, campañas
  settings/            — Admin, auxiliar, setup wizard
  utils/               — Date, share, informe, confirm, prompt-modal
  data/                — Parser
```

## Supabase Project
- **Ref**: dxrhvusvplcotwmxpbov
- **URL**: https://dxrhvusvplcotwmxpbov.supabase.co
- **Region**: us-east-1 | Postgres 17.6
- **Tables**: notes, vaults, vault_members, profiles, invitations, rate_limits
- **RPC functions**: create_vault, join_vault, resolve_invitation, generate_invitation, approve_user, check_user_approval, get_pending_users
