# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.0.x-beta | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email **zlatan@ascentsystemes.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You will receive an acknowledgment within 48 hours and a detailed response within 7 days.

## Security Considerations

### Passwords
- Database passwords are **never** stored in localStorage or persisted to disk
- Passwords are held in-memory only (Zustand store, non-persisted)
- Connections are transmitted over the local network to the API server

### Sessions
- Session IDs are cryptographically random UUIDs (`crypto.randomUUID()`)
- Sessions expire after 30 minutes of inactivity
- Sessions are stored in server memory only (lost on restart)

### SQL Injection
- All user-provided values use parameterized queries (`?` placeholders)
- Table/column names are validated against the actual schema before use
- Boolean values are inlined as `TRUE`/`FALSE` literals (driver limitation)

### CORS
- Default CORS origin is `http://localhost:5173` (development)
- Production deployments should set `CORS_ORIGIN` to the specific domain

### Recommendations for Production
- Deploy behind HTTPS (TLS termination via reverse proxy)
- Restrict `CORS_ORIGIN` to your domain
- Use Firebird's built-in user authentication
- Run containers with minimal privileges
- Do not expose port 3001 (API) directly — let nginx proxy it
