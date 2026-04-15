# Firebird Web Client — SPECS.md

## Overview

A full-featured web-based IDE for Firebird databases. Node.js/Fastify backend proxy + React 19/Vite frontend. Provides table/view/procedure/trigger/generator/domain management, SQL execution, inline editing, filtering, export, and multi-database support.

---

## Architecture

```
firebird-web-client/
├── server/                          # Node.js + Fastify proxy
│   └── src/
│       ├── index.ts                 # App entry, route registration
│       ├── db.ts                    # Connection pool, sessions, query queue
│       ├── types.ts                 # Shared interfaces
│       └── routes/
│           ├── connection.ts        # Auth, database discovery, switching
│           ├── schema.ts            # Schema browsing, DDL, object CRUD
│           ├── data.ts              # Row CRUD, pagination, filtering
│           ├── sql.ts               # Raw SQL execution
│           └── export.ts            # Table/database export
│
├── client/                          # React 19 + Vite + Tailwind CSS v4
│   └── src/
│       ├── App.tsx                  # Root layout, routing, theme
│       ├── main.tsx                 # Entry with QueryClientProvider
│       ├── index.css                # Theme variables, animations
│       ├── components/              # 35 components
│       ├── hooks/                   # 7 custom hooks
│       ├── store/                   # Zustand connection store
│       └── lib/                     # API, filters, export, themes, dialect
│
├── CLAUDE.md                        # Development guide
├── SPECS.md                         # This file
└── README.md                        # User documentation
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 19 |
| Build tool | Vite | 8 |
| Styling | Tailwind CSS | 4 |
| Data grid | TanStack Table | 8 |
| Server state | TanStack Query | 5 |
| Client state | Zustand | 5 |
| Code editor | CodeMirror | 6 |
| Icons | Lucide React | 1.8 |
| Backend | Fastify | 5 |
| DB driver | node-firebird | 1.1 |
| Validation | Zod | 3 |
| Excel export | SheetJS (xlsx) | 0.18 |
| File download | file-saver | 2 |
| Language | TypeScript | 5/6 (strict) |

---

## API Endpoints

### Connection & Session

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/connect` | No | Connect to server. `database` optional — returns `{ sessionId, databases?, noDatabase? }` |
| `DELETE` | `/api/disconnect` | Yes | Close session, detach DB |
| `POST` | `/api/test-connection` | No | Test credentials, discover aliases |
| `GET` | `/api/ping` | No | Health check — `{ ok: true, version }` |
| `GET` | `/api/databases` | Yes | List databases (aliases + filesystem scan) |
| `POST` | `/api/select-database` | Yes | Switch to different database (same session) |
| `GET` | `/api/server-info` | Yes | Firebird version, user, connection ID |

### Schema

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/sidebar` | Yes | All schema data: tables, views, procedures, triggers, generators, domains, counts |
| `GET` | `/api/tables` | Yes | List table names |
| `GET` | `/api/tables/counts` | Yes | Row counts per table |
| `GET` | `/api/tables/:name/schema` | Yes | Column definitions |
| `GET` | `/api/tables/:name/ddl` | Yes | CREATE TABLE DDL |
| `POST` | `/api/tables` | Yes | Create table — `{ name, columns }` |
| `DELETE` | `/api/tables/:name` | Yes | Drop table |
| `POST` | `/api/tables/:name/columns` | Yes | Add column |
| `PUT` | `/api/tables/:name/columns/:col` | Yes | Alter column |
| `DELETE` | `/api/tables/:name/columns/:col` | Yes | Drop column |
| `GET` | `/api/views/:name` | Yes | View detail (source, columns) |
| `POST` | `/api/views` | Yes | Create/alter view |
| `DELETE` | `/api/views/:name` | Yes | Drop view |
| `GET` | `/api/procedures/:name` | Yes | Procedure detail (source, params) |
| `POST` | `/api/procedures` | Yes | Create/alter procedure |
| `DELETE` | `/api/procedures/:name` | Yes | Drop procedure |
| `GET` | `/api/triggers/:name` | Yes | Trigger detail |
| `POST` | `/api/triggers` | Yes | Create/alter trigger |
| `PUT` | `/api/triggers/:name/toggle` | Yes | Activate/deactivate trigger |
| `DELETE` | `/api/triggers/:name` | Yes | Drop trigger |
| `POST` | `/api/generators` | Yes | Create generator |
| `PUT` | `/api/generators/:name` | Yes | Set generator value |
| `DELETE` | `/api/generators/:name` | Yes | Drop generator |
| `POST` | `/api/domains` | Yes | Create domain |
| `DELETE` | `/api/domains/:name` | Yes | Drop domain |
| DDL endpoints | `/api/*/ddl` | Yes | DDL for procedures, triggers, generators, domains |

### Data

| Method | Path | Auth | Query Params | Description |
|--------|------|------|-------------|-------------|
| `GET` | `/api/tables/:name/rows` | Yes | `page, pageSize, orderBy, orderDir, filters` | Paginated rows with sort & filter |
| `POST` | `/api/tables/:name/rows` | Yes | | Insert row — `{ values }` |
| `PUT` | `/api/tables/:name/rows/:pk` | Yes | | Update row — `{ values }` |
| `DELETE` | `/api/tables/:name/rows/:pk` | Yes | | Delete row |

**Filter parameter**: JSON-encoded `{ globalSearch: string, columnFilters: [{ column, operator, value }] }`

**Operators**: `eq, neq, gt, lt, gte, lte, contains, not_contains, starts_with, ends_with, is_null, is_not_null`

### SQL & Export

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/sql` | Yes | Execute raw SQL — returns `{ rows, fields, rowsAffected, duration }` |
| `GET` | `/api/export/table/:name` | Yes | Export table (format: csv/json/sql/xml, includeDdl, delimiter) |
| `GET` | `/api/export/database` | Yes | Export full database |

---

## Data Types

### ConnectionConfig
```typescript
{ host: string, port: number, database: string, user: string, password: string }
```

### ColumnDef
```typescript
{ name: string, type: string, typeCode?: number, nullable: boolean, primaryKey: boolean, length?: number, defaultValue?: string }
```

### QueryResult
```typescript
{ rows: Record<string, unknown>[], fields: { name: string, type: string }[], rowsAffected: number, duration: number }
```

### MutationResult
```typescript
{ ok?: boolean, inserted?: boolean, updated?: boolean, deleted?: boolean, sql?: string, duration?: number }
```

### FilterState
```typescript
{ globalSearch: string, columnFilters: { column: string, operator: FilterOperator, value: string }[] }
```

### DatabaseInfo
```typescript
{ name: string, path: string, source: 'alias' | 'file' }
```

### AppSettings
```typescript
{
  pageSize: number, nullDisplay: string, dateFormat: string, lazyLoadLists: boolean,
  editorFontSize: number, editorLineNumbers: boolean, editorWordWrap: boolean, editorTabSize: number,
  themePreference: 'system' | 'light' | 'dark', executeOnCtrlEnter: boolean,
  queryHistoryLimit: number | '∞', autoReconnect: boolean,
  defaultExportFormat: 'csv' | 'json' | 'sql' | 'xml' | 'xlsx',
  exportIncludeDdl: boolean, csvDelimiter: ',' | ';' | '\t'
}
```

---

## Session Management

- Sessions stored in server-memory `Map<string, SessionEntry>`
- Session IDs are UUIDs (`crypto.randomUUID()`)
- 30-minute TTL with automatic cleanup
- All authenticated requests require `x-session-id` header
- Sessions lost on server restart — client auto-reconnects
- Per-session query queue prevents concurrent access deadlocks
- "No-database" sessions allowed (db=null) for database discovery

---

## UI Components (35)

### Core Layout
`App`, `Sidebar`, `Dashboard`, `StatusBar`, `ConnectionPanel`, `DisconnectModal`

### Data Views
`TableView`, `SchemaView`, `RowEditor`, `SqlEditor`, `ObjectListPage`, `ObjectDetailView`, `NewObjectView`

### Data Features
`InlineEditCell`, `DataFilterBar`, `PaginationBar`, `CopyCell`, `RowCopyMenu`, `TruncateCell`, `Checkbox`

### Modals & Overlays
`ExportModal`, `BulkDeleteModal`, `SelectAllPopover`, `ConfigImportModal`, `Toast`, `Tooltip`

### Status & Indicators
`ServerHealthIndicator`, `GlobalRequestIndicator`

### Editor
`FirebirdCodeEditor`, `SqlHighlight`

### Visual
`SplashScreen`, `OutroScreen`, `AudioVisualizer`, `ReactiveBackground`

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
|----------|---------|--------|
| Cmd/Ctrl+Enter | SQL Editor | Execute query |
| Cmd/Ctrl+Enter | Inline edit | Save cell |
| Shift+Enter | Table/View data tab | Insert new row |
| Escape | Any modal/edit | Cancel/close |
| Double-click cell | Table data | Edit cell inline |
| Click row | Table data | Toggle selection |
| Arrow Up/Down | Database dropdown | Navigate options |
| Enter | Database dropdown | Select database |

---

## Theme System

### CSS Variables (index.css)
- `:root` — light theme defaults
- `.dark` — dark theme overrides
- `@theme` block — Tailwind v4 variable registration

### Accent Colors (10 presets)
Blue, Indigo, Violet, Purple, Rose, Orange, Amber, Emerald, Teal, Cyan — each with light/dark palette. Applied at runtime via `document.documentElement.style.setProperty()`. Stored in `localStorage` as index (0-9).

### Fonts
- **JetBrains Mono** — code, data cells, SQL editor
- **Inter** — UI labels, buttons, headers
