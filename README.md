<p align="center">
  <img src="https://img.shields.io/badge/Firebird-Web%20Client-3b82f6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIj48ZWxsaXBzZSBjeD0iMTIiIGN5PSI1IiByeD0iOSIgcnk9IjMiLz48cGF0aCBkPSJNMyA1djE0YzAgMS42NiA0LjAzIDMgOSAzczktMS4zNCA5LTNWNS8+PHBhdGggZD0iTTMgMTJjMCAxLjY2IDQuMDMgMyA5IDNzOS0xLjM0IDktMyIvPjwvc3ZnPg==&logoColor=white" alt="Firebird Web Client" />
</p>

<p align="center">
  <strong>The most complete web-based IDE for Firebird databases.</strong>
</p>

<p align="center">
  <a href="https://github.com/ZlatanOmerovic/firebird-web-client/actions/workflows/release.yml"><img src="https://github.com/ZlatanOmerovic/firebird-web-client/actions/workflows/release.yml/badge.svg" alt="Build Status" /></a>
  <a href="https://hub.docker.com/r/zlomerovic/firebird-web-client"><img src="https://img.shields.io/docker/v/zlomerovic/firebird-web-client?label=Docker&logo=docker&logoColor=white&style=flat-square" alt="Docker" /></a>
  <img src="https://img.shields.io/github/v/tag/ZlatanOmerovic/firebird-web-client?label=Version&style=flat-square&color=3b82f6" alt="Version" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify&logoColor=white" alt="Fastify" />
  <img src="https://img.shields.io/badge/Firebird-2.5%20%7C%203%20%7C%204%20%7C%205-orange?style=flat-square" alt="Firebird Support" />
</p>

---

## Features

### Database Management
- **Multi-database support** -- connect without specifying a database, discover available databases from `databases.conf` and filesystem, switch between databases live
- **Connection profiles** -- save, name, and manage multiple connections with timestamps (last used, last disconnected)
- **Auto-reconnect** -- session restoration on page reload
- **Server health monitoring** -- real-time status indicator with countdown alert and recovery instructions

### Data Browsing & Editing
- **Table data grid** -- powered by TanStack Table with server-side pagination, sorting, and filtering
- **Inline cell editing** -- double-click any cell to edit in place with type-appropriate inputs (number, date, time, datetime, textarea, boolean checkbox)
- **Bulk operations** -- select multiple rows with checkboxes, bulk delete with confirmation, "select all N records" popover for full-table operations
- **Column resize** -- drag column borders to adjust widths, persisted per table in localStorage
- **Cell tooltips** -- hover truncated cells to see full values
- **Copy** -- per-cell copy icon, per-row copy menu (SQL INSERT, JSON, CSV, Raw Text formats)

### Schema Management
- **Full object support** -- tables, views, procedures, triggers, generators (sequences), domains
- **DDL inspection** -- view CREATE statements for any object
- **Schema editing** -- add, alter, drop columns with type-appropriate form fields
- **Create objects** -- modal-based forms for creating new tables, views, procedures, triggers, generators, domains

### SQL Editor
- **CodeMirror 6** with custom Firebird SQL dialect (250+ keywords) and Darcula/IntelliJ themes
- **Query execution** -- Cmd/Ctrl+Enter to run, results grid with pagination
- **Query history** -- auto-saved with timestamps, searchable, re-runnable
- **Server-side sorting** for result sets
- **Action feedback** -- every operation shows a toast with timing and the actual SQL executed, with copy and "Open in Editor" actions

### Filtering & Search
- **Global search** -- search across all columns with wildcard (`*`) support
- **Per-column filters** -- 11 operators (=, !=, >, <, >=, <=, contains, starts with, ends with, is null, is not null) with type-aware operator selection
- **Server-side** for tables/views, **client-side** for SQL results

### Export
- **5 formats** -- CSV (configurable delimiter), JSON, SQL (with optional DDL), XML, XLSX
- **Multiple scopes** -- selected rows, full table, entire database
- **Server-side streaming** for large exports
- **Settings integration** -- default format, DDL inclusion, CSV delimiter preferences

### Appearance
- **Dark & light themes** with system preference detection
- **10 accent colors** -- Blue, Indigo, Violet, Purple, Rose, Orange, Amber, Emerald, Teal, Cyan
- **Collapsible sidebar** with color-coded sections and legend
- **Responsive layout** with horizontal scroll for wide tables

### Configuration
- **Settings page** -- page size, NULL display, date format, editor preferences, export defaults
- **Config export/import** -- export all settings as JSON, import via file upload or paste on login page
- **Database conversion** (coming soon) -- MySQL, MariaDB, PostgreSQL, MSSQL, SQLite, Oracle, CockroachDB

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, TanStack Table, TanStack Query, CodeMirror 6, Zustand, Lucide Icons |
| **Backend** | Node.js, Fastify 5, TypeScript, Zod |
| **Database Driver** | node-firebird (wire protocol) |
| **Export** | SheetJS (XLSX), file-saver |

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **Firebird** server (2.5, 3.0, 4.0, or 5.0) -- local, remote, or Docker

### Install & Run

```bash
# Clone the repository
git clone https://github.com/ZlatanOmerovic/firebird-web-client.git
cd firebird-web-client

# Install all dependencies
npm install

# Start both server and client
npm run dev
```

- **Client**: http://localhost:5173
- **API Server**: http://localhost:3001

### With Docker Compose (Production)

```bash
# Run the full stack (client on port 6969, server on 3001 internally)
docker compose up -d
```

Open http://localhost:6969

### With Docker (Firebird only)

```bash
# Run Firebird 5 in Docker for development
docker run -d --name firebird \
  -p 3050:3050 \
  -e FIREBIRD_DATABASE=mydb.fdb \
  -e FIREBIRD_USER=SYSDBA \
  -e ISC_PASSWORD=masterkey \
  jacobalberty/firebird:v5

# Start the web client in dev mode
npm run dev
```

Then connect with: `localhost:3050` / `SYSDBA` / `masterkey`

### Docker Hub

```bash
# Pull pre-built images
docker pull zlomerovic/firebird-web-client:latest
docker pull zlomerovic/firebird-web-server:latest
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server + client concurrently |
| `npm run dev -w server` | Start API server only (port 3001) |
| `npm run dev -w client` | Start Vite dev server only (port 5173) |
| `npm run build` | Build both workspaces for production |

---

## Environment Variables

### Server (`server/.env`)
```env
PORT=3001                           # API server port
CORS_ORIGIN=http://localhost:5173   # Allowed CORS origin
```

### Client (`client/.env`)
```env
VITE_API_URL=/api                   # API base URL (proxied in dev)
VITE_DEFAULT_HOST=localhost         # Pre-fill connection form
VITE_DEFAULT_PORT=3050
VITE_DEFAULT_USER=SYSDBA
VITE_DEFAULT_DATABASE=employee
```

---

## API Endpoints

### Connection
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/connect` | Connect to Firebird (database optional) |
| `DELETE` | `/api/disconnect` | Close connection |
| `POST` | `/api/test-connection` | Test connection + discover databases |
| `GET` | `/api/ping` | Health check |
| `GET` | `/api/databases` | List available databases |
| `POST` | `/api/select-database` | Switch to different database |
| `GET` | `/api/server-info` | Firebird version, user, connection info |

### Schema
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sidebar` | All schema data in one request |
| `GET` | `/api/tables/:name/schema` | Column definitions |
| `GET` | `/api/tables/:name/ddl` | DDL for table |
| `POST` | `/api/tables` | Create table |
| `DELETE` | `/api/tables/:name` | Drop table |
| `POST` | `/api/tables/:name/columns` | Add column |
| `PUT` | `/api/tables/:name/columns/:col` | Alter column |
| `DELETE` | `/api/tables/:name/columns/:col` | Drop column |

### Data
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tables/:name/rows` | Paginated rows with sort & filter |
| `POST` | `/api/tables/:name/rows` | Insert row |
| `PUT` | `/api/tables/:name/rows/:pk` | Update row |
| `DELETE` | `/api/tables/:name/rows/:pk` | Delete row |

### SQL & Export
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sql` | Execute raw SQL |
| `GET` | `/api/export/table/:name` | Export table (CSV/JSON/SQL/XML) |
| `GET` | `/api/export/database` | Export full database |

---

## Architecture

```
firebird-web-client/
├── server/                     # Node.js + Fastify backend
│   └── src/
│       ├── index.ts            # App entry, route registration
│       ├── db.ts               # Firebird pool, sessions, query queue
│       ├── types.ts            # Shared interfaces
│       └── routes/
│           ├── connection.ts   # Auth, database discovery, switching
│           ├── schema.ts       # Schema browsing, DDL, object CRUD
│           ├── data.ts         # Row CRUD, pagination, filtering
│           ├── sql.ts          # Raw SQL execution
│           └── export.ts       # Table/database export
│
├── client/                     # React 19 + Vite frontend
│   └── src/
│       ├── App.tsx             # Root with routing, theme, layout
│       ├── components/         # 35 React components
│       ├── hooks/              # 7 custom hooks
│       ├── store/              # Zustand connection store
│       └── lib/                # API client, filters, export, themes
│
├── CLAUDE.md                   # AI development guide
├── SPECS.md                    # Full specification
└── README.md                   # This file
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Execute SQL query / Save inline edit |
| `Shift + Enter` | Insert new row |
| `Escape` | Cancel edit / Close modal |
| `Double-click cell` | Edit cell inline |
| `Click row` | Toggle row selection |
| `Double-click row` | Navigate to object (in list pages) |

---

## Known Limitations

- **node-firebird** does not support `MON$` monitoring tables (crashes the wire protocol)
- **BLOB fields** are displayed as `[BLOB]` — use `CAST(blob AS VARCHAR(N))` in SQL for text BLOBs
- **ARRAY columns** are expanded into individual element columns (e.g. `COL[1]`, `COL[2]`)
- **BOOLEAN** type requires Firebird 3.0+ (type code 23)
- Sessions are in-memory — lost on server restart (auto-reconnect handles this)

---

## Upcoming

- Docker Compose deployment
- Database conversion (Firebird to MySQL/PostgreSQL/MSSQL/SQLite/Oracle)
- Multi-connection tabs
- ER diagram visualization
- Query builder (visual)
- Stored procedure debugger

---

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/ZlatanOmerovic">Ascent Syst&egrave;mes</a> with <a href="https://claude.ai/code">Claude Code</a>
</p>
