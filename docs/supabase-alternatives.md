# Supabase Alternatives

## Context
Supabase has been experiencing infrastructure issues since June 30, 2026, causing 400 errors on upsert operations. This document outlines alternatives for the Mi Agrupación Plus plugin backend.

## Alternatives

### Appwrite (Recommended)
- **Type**: Open-source BaaS
- **Database**: MariaDB/PostgreSQL (real SQL)
- **Auth**: Built-in
- **Real-time**: Yes
- **Self-host**: Yes, or use Appwrite Cloud (free tier)
- **Why**: Most similar to Supabase. Same philosophy, SQL database, REST API. Open-source means the code is public and free to use.
- **Cloud**: appwrite.io — they manage the server, you just use the API
- **Self-host**: Requires Docker on a VPS (~$5/mes on DigitalOcean, Hetzner) or local machine

### PocketBase (Simplest)
- **Type**: Single-binary BaaS
- **Database**: SQLite
- **Auth**: Built-in
- **Real-time**: Yes
- **Self-host**: Yes (single file, no Docker needed)
- **Free tier**: N/A (self-host only)
- **Why**: Ultra simple. One file, SQLite, no dependencies. Deploy to Railway (free) or Fly.io.
- **Best for**: Smallest possible backend, minimal complexity

### Firebase (Most Mature)
- **Type**: Google BaaS
- **Database**: Firestore (NoSQL) or Realtime Database
- **Auth**: Built-in
- **Real-time**: Yes
- **Self-host**: No
- **Free tier**: Generous
- **Why**: Most documented, most stable. Requires data structure migration from SQL to NoSQL.
- **Best for**: If you want the most proven option and don't mind NoSQL

### Convex (Modern)
- **Type**: Modern BaaS
- **Database**: Proprietary
- **Auth**: Built-in
- **Real-time**: Native
- **Self-host**: No
- **Free tier**: Generous
- **Why**: TypeScript-first, real-time by default. Very clean API.
- **Best for**: New projects that want modern DX

### Neon (Serverless Postgres)
- **Type**: Serverless PostgreSQL
- **Database**: PostgreSQL
- **Auth**: No (need to add separately, e.g., Clerk, Auth0)
- **Real-time**: No native
- **Self-host**: No
- **Free tier**: Yes
- **Why**: Just Postgres, no BaaS layer. More control, more work.
- **Best for**: If you want full control over the backend

## Migration Notes

Current Supabase usage in Mi Agrupación Plus:
- **Auth**: Email/password via Supabase Auth
- **Database**: PostgreSQL tables (notes, vaults, vault_members, profiles, invitations)
- **API**: PostgREST (REST API auto-generated from DB schema)
- **RLS**: Row Level Security for multi-tenant isolation

If migrating to Appwrite:
- Auth translates directly (email/password)
- Database: Appwrite has its own DB with collections (similar to tables)
- API: Appwrite SDK or REST API
- Permissions: Appwrite has document-level permissions (similar to RLS)

If migrating to PocketBase:
- Auth translates directly
- Database: SQLite with collections
- API: Built-in REST API
- Permissions: Record-level rules

## Decision
TBD — evaluate after Supabase incident resolves.
