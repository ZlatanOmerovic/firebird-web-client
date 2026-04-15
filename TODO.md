# TODO — Firebird Web Client Roadmap

## v0.1.0 (Next Release)

### Features
- [ ] Docker Compose one-command deployment with Firebird included
- [ ] ER diagram visualization (table relationships)
- [ ] Multi-connection tabs (connect to multiple databases simultaneously)
- [ ] Query builder (visual drag-and-drop)
- [ ] Import data (CSV, JSON, SQL, XLSX → table)
- [ ] Table data diff/compare between two tables
- [ ] Stored procedure debugger (step-through execution)

### Database Conversion
- [ ] Firebird → MySQL schema + data conversion
- [ ] Firebird → PostgreSQL schema + data conversion
- [ ] Firebird → MariaDB schema + data conversion
- [ ] Firebird → MSSQL schema + data conversion
- [ ] Firebird → SQLite schema + data conversion
- [ ] Firebird → Oracle schema + data conversion
- [ ] Firebird → CockroachDB schema + data conversion

### UX Improvements
- [ ] Drag-and-drop column reordering in table grid
- [ ] Pin/freeze columns (keep visible while scrolling)
- [ ] Table row numbering (absolute row index)
- [ ] Multi-cell selection (Shift+Click range)
- [ ] Undo/redo for inline edits
- [ ] Keyboard-only table navigation (arrow keys between cells)
- [ ] Context menu (right-click) on rows and cells
- [ ] Full-text search across entire database

### Performance
- [ ] Virtual scrolling for very large result sets (100k+ rows)
- [ ] WebSocket for real-time query progress
- [ ] Background query execution with notification on completion
- [ ] Query plan visualization (EXPLAIN output)

## v0.2.0 (Future)

- [ ] User management (Firebird security database)
- [ ] Backup/restore via gbak integration
- [ ] Database statistics (gstat integration)
- [ ] Table space usage visualization
- [ ] Scheduled queries (cron-like)
- [ ] Query sharing via URL
- [ ] Collaborative editing (multi-user)
- [ ] Plugin system for custom extensions
- [ ] REST API mode (use the server as a Firebird REST gateway)
- [ ] GraphQL endpoint generation from schema

## Known Issues

- [ ] `node-firebird` crashes on `MON$` monitoring table queries
- [ ] BLOB fields display as `[BLOB]` — no inline preview
- [ ] ARRAY columns expanded but not editable as arrays
- [ ] Large database export may timeout on very large tables (>1M rows)
- [ ] Session lost on server restart (by design — sessions are in-memory)

## Completed (v0.0.1-beta)

- [x] Multi-database support with live switching
- [x] Table/view/procedure/trigger/generator/domain CRUD
- [x] SQL editor with CodeMirror 6 + Firebird dialect
- [x] Inline cell editing with type-aware inputs
- [x] Boolean field checkboxes
- [x] Server-side filtering (11 operators)
- [x] Export to CSV, JSON, SQL, XML, XLSX
- [x] 10 accent color themes + dark/light mode
- [x] Bulk operations with "select all N records" popover
- [x] Query history with search and re-run
- [x] Pagination (top + bottom) with jump-to-page
- [x] Column resize with localStorage persistence
- [x] Cell/row copy (SQL INSERT, JSON, CSV, Raw Text)
- [x] Action toasts with SQL display + "Open in Editor"
- [x] Server health monitoring with recovery UI
- [x] Config import/export
- [x] Saved connections with timestamps
- [x] Database discovery from databases.conf + filesystem
- [x] Docker Compose deployment
- [x] GitHub Actions CI/CD pipeline
