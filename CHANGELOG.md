# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1-beta] - 2026-04-15

### Added

#### Core
- Node.js/Fastify backend proxy with session-based authentication
- React 19 frontend with Vite, TypeScript strict mode, Tailwind CSS v4
- Multi-database support — connect without specifying a database, discover available databases, switch live
- Connection profiles — save, name, and manage multiple connections with timestamps
- Auto-session restoration on page reload
- Server health monitoring with countdown alert and recovery instructions
- 30-minute session TTL with automatic cleanup

#### Data Management
- Table data grid powered by TanStack Table with server-side pagination, sorting, and filtering
- Inline cell editing — double-click any cell with type-appropriate inputs
- Boolean field checkboxes with NULL/DEFAULT controls
- Bulk operations — select multiple rows, "select all N records" popover (Gmail-style)
- Column resize with drag handles and localStorage persistence
- Cell tooltips for truncated values
- Per-cell copy icon and per-row copy menu (SQL INSERT, JSON, CSV, Raw Text)

#### Schema Management
- Full support for tables, views, procedures, triggers, generators (sequences), domains
- DDL inspection for all object types
- Schema editing — add, alter, drop columns
- Create/drop objects via modal forms

#### SQL Editor
- CodeMirror 6 with custom Firebird SQL dialect (250+ keywords)
- Darcula (dark) and IntelliJ (light) editor themes
- Query history — auto-saved, searchable, re-runnable
- Server-side sorting for result sets
- Client-side filtering for results

#### Filtering
- Global search across all columns with wildcard (`*`) support
- Per-column filters with 11 operators
- Server-side for tables/views, client-side for SQL results

#### Export
- 5 formats: CSV, JSON, SQL (with optional DDL), XML, XLSX
- Export selected rows, full table, or entire database
- Server-side streaming for large exports
- Configurable CSV delimiter and DDL inclusion

#### Appearance
- Dark and light themes with system preference detection
- 10 accent color themes
- Collapsible sidebar with color-coded sections
- Responsive layout

#### Action Feedback
- Success toasts with execution timing for every operation
- SQL display in toasts with syntax highlighting
- Copy SQL and "Open in Editor" from toasts

#### Configuration
- Settings page with 15+ preferences
- Config export/import (JSON file or paste)
- Database conversion section (coming soon)

#### Infrastructure
- Docker Compose deployment (client + server)
- GitHub Actions CI/CD pipeline
- Automatic Docker Hub publishing on release
- Git tag-based versioning

### Known Limitations
- `node-firebird` crashes on MON$ monitoring table queries
- BLOB fields displayed as [BLOB] — no inline preview
- ARRAY columns expanded but not editable as arrays
- Sessions are in-memory (lost on server restart)
