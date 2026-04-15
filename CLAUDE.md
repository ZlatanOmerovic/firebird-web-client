# CLAUDE.md — Firebird Web Client

## Project Overview

A full-featured web-based IDE for Firebird databases. Two workspaces:
- `server/` — Node.js + Fastify + TypeScript API proxy (port 3001)
- `client/` — React 19 + Vite + TypeScript + Tailwind CSS v4 frontend (port 5173)

Read `SPECS.md` for detailed API contracts, `README.md` for user-facing docs, `CONTRIBUTING.md` for development workflow, and `DOCKER.md` for deployment.

---

## Commands

```bash
npm install                    # Install all deps (root + workspaces)
npm run dev                    # Start both server + client
npm run dev -w server          # Server only
npm run dev -w client          # Client only
npm run build                  # Production build
```

---

## Architecture

### Server (`server/src/`)

| File | Purpose |
|------|---------|
| `index.ts` | Fastify app entry, registers all route plugins + CORS |
| `db.ts` | Firebird connection via `node-firebird`, session management (Map), query queue (per-session serialization), 30-min session TTL |
| `types.ts` | Shared interfaces: `ConnectionConfig`, `ColumnDef`, `QueryResult` |
| `routes/connection.ts` | Connect, disconnect, test-connection, database discovery, database switching, server info |
| `routes/schema.ts` | Sidebar data (single endpoint), table/view/procedure/trigger/generator/domain CRUD and DDL |
| `routes/data.ts` | Row CRUD with pagination, sorting, server-side filtering (WHERE clause builder), boolean handling |
| `routes/sql.ts` | Raw SQL execution |
| `routes/export.ts` | Table and full-database export (CSV, JSON, SQL, XML) |

**Key patterns:**
- All DB operations go through `queryAsync()` which serializes queries per session via `enqueue()`
- `node-firebird` BLOBs return as callbacks → `stripBlobs()` converts to null
- ARRAY columns detected via `RDB$FIELD_DIMENSIONS` → expanded into individual elements in SELECT
- BOOLEAN values must be inlined as `TRUE`/`FALSE` literals (not parameterized — driver bug)
- All mutation responses include `{ sql, duration }` for the action toast system
- Session IDs are UUIDs via `crypto.randomUUID()`

### Client (`client/src/`)

| Directory | Contents |
|-----------|----------|
| `components/` | 35 React components (see README for full list) |
| `hooks/` | `useSettings`, `useServerHealth`, `useColumnResize`, `useSql`, `useTableData`, `useTables`, `useConnection` |
| `store/` | Zustand store: connection state, database list, current DB, session management |
| `lib/api.ts` | Typed fetch wrappers for every endpoint, session header injection |
| `lib/filters.ts` | Filter types, operators, client-side `applyClientFilters()` for SQL results |
| `lib/exportUtils.ts` | CSV/JSON/SQL/XML/XLSX export builders + download helpers |
| `lib/accentColors.ts` | 10 accent color themes with light/dark variants, CSS variable injection |
| `lib/firebirdDialect.ts` | CodeMirror SQL dialect with 250+ Firebird keywords |
| `lib/firebirdTheme.ts` | CodeMirror dark (Darcula) and light (IntelliJ) themes |

**Key patterns:**
- TanStack Query for all server state (query keys: `['sidebar']`, `['rows', tableName, ...]`, `['schema', tableName]`)
- TanStack Table for data grids with `manualSorting: true` (server-side)
- `useColumnResize` hook with localStorage persistence per table
- Portal-based tooltips, popovers, and edit toolbars (escape overflow containers)
- `actionToast()` for success feedback with SQL display
- `InlineEditCell` handles all types: text (textarea), number, date, time, datetime, boolean (checkbox)

---

## Firebird-Specific Knowledge

### node-firebird Limitations
- **No MON$ tables** — querying `MON$DATABASE` crashes the wire protocol. Use `RDB$DATABASE` + `RDB$GET_CONTEXT` instead.
- **BLOB fields** — returned as callback functions. `stripBlobs()` converts to null. Use `CAST(blob AS VARCHAR(N))` in SQL.
- **BOOLEAN params** — passing `true`/`false` as `?` params converts to `"0"`/`"1"` strings which Firebird rejects. Inline as `TRUE`/`FALSE` SQL literals instead.
- **ARRAY columns** — returned as `{ low, high }` descriptor objects. Detect via `RDB$FIELD_DIMENSIONS` and expand in SELECT.
- **CURRENT_TIMESTAMP** — raw TIMESTAMP WITH TIME ZONE crashes. Use `CAST(CURRENT_TIMESTAMP AS VARCHAR(50))`.
- **Concurrent queries** — `node-firebird` deadlocks on concurrent queries per connection. All queries are serialized via `enqueue()`.

### Firebird Field Type Codes
```
7=SMALLINT  8=INTEGER  10=FLOAT  12=DATE  13=TIME
14=CHAR  16=BIGINT  23=BOOLEAN  27=DOUBLE  35=TIMESTAMP
37=VARCHAR  261=BLOB
```

### System Table Queries
- Tables: `RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NULL`
- Views: `RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NOT NULL`
- Procedures: `RDB$PROCEDURES WHERE RDB$SYSTEM_FLAG=0`
- Triggers: `RDB$TRIGGERS WHERE RDB$SYSTEM_FLAG=0`
- Generators: `RDB$GENERATORS WHERE RDB$SYSTEM_FLAG=0`
- Domains: `RDB$FIELDS WHERE RDB$FIELD_NAME NOT STARTING WITH 'RDB$'`

---

## CSS / Theme System

- **Light theme**: `:root` variables — gray-tinted backgrounds (#f5f6f8, #eceef1, #e3e5ea)
- **Dark theme**: `.dark` class — deep blue-tinted darks (#0f1117, #161922, #1c1f2b)
- **Accent colors**: 10 presets in `accentColors.ts`, applied via CSS variables at runtime
- **Fonts**: JetBrains Mono (code/data), Inter (UI labels) — loaded from Google Fonts
- **Tailwind v4**: Uses `@theme` block for CSS variable registration

---

## Do Not

- Do not use `console.log` — use proper error handling
- Do not store passwords in localStorage (rawPassword is in-memory only via Zustand)
- Do not use `SELECT *` in system table queries — always name columns
- Do not query `MON$` tables (crashes node-firebird)
- Do not pass boolean values as `?` params — inline as TRUE/FALSE
- Do not create CSS files per component — use Tailwind utility classes
- Do not use `useEffect` for data fetching — use TanStack Query hooks
- Do not add dependencies without a clear reason documented in the commit

---

## Testing

```bash
# Test server connection
curl -X POST http://localhost:3001/api/connect \
  -H "Content-Type: application/json" \
  -d '{"host":"localhost","port":3050,"database":"employee","user":"SYSDBA","password":"masterkey"}'

# Use returned sessionId for all subsequent requests
curl http://localhost:3001/api/sidebar \
  -H "x-session-id: <sessionId>"

# Execute SQL
curl -X POST http://localhost:3001/api/sql \
  -H "Content-Type: application/json" \
  -H "x-session-id: <sessionId>" \
  -d '{"query":"SELECT FIRST 10 * FROM EMPLOYEE"}'
```

---

## localStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `firebird-settings` | object | App settings (page size, theme, editor prefs, etc.) |
| `firebird-saved-connections` | array | Saved connection profiles with timestamps |
| `firebird-connection` | object | Zustand persisted state (config, sessionId) |
| `firebird-theme` | string | `'dark'` or `'light'` |
| `firebird-accent-color` | string | Accent color index (0-9) |
| `firebird-sidebar-collapsed` | string | `'0'` or `'1'` |
| `firebird-sql-history-v2` | array | Query history entries |
| `firebird-editor-height` | string | SQL editor panel height in px |
| `firebird-colwidths-*` | object | Column widths per table/view |
