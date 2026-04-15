# Contributing to Firebird Web Client

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 20+
- A running Firebird server (2.5, 3.0, 4.0, or 5.0)
- Git

### Setup

```bash
git clone git@github.com:ZlatanOmerovic/firebird-web-client.git
cd firebird-web-client
npm install
npm run dev
```

## Git Workflow

We use **main + develop** branching:

```
main        ← production releases (tagged)
  ↑
develop     ← integration branch
  ↑
feature/*   ← your work
```

### Creating a Feature

```bash
# Start from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# ... make changes ...

# Commit with conventional commits
git commit -m "feat: add awesome feature"

# Push and create PR against develop
git push origin feature/your-feature-name
```

### Branch Naming

| Prefix | Use |
|--------|-----|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code refactoring |
| `chore/` | Build, CI, tooling |

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add inline cell editing
fix: prevent SQL injection in export query
docs: update README with Docker instructions
refactor: extract FilterBar into separate component
chore: update dependencies
```

## Code Standards

### TypeScript

- **Strict mode** everywhere — no `any` except where unavoidable (raw Firebird results)
- Use interfaces over types for object shapes
- Export types separately from implementations

### React

- Functional components only
- TanStack Query for all server state — never `useEffect` for data fetching
- Zustand for client-only state
- Tailwind utility classes — no CSS files per component

### Server

- All DB operations through `queryAsync()` (serialized per session)
- Parameterized queries — never interpolate user input into SQL
- Return `{ sql, duration }` from all mutation endpoints
- Wrap endpoints in try/catch with proper error responses

### Naming

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `camelCase.ts`
- CSS: Tailwind utilities only

## Pull Requests

### Before Submitting

1. **Type check**: `npx tsc --noEmit -p server/tsconfig.json && npx tsc --noEmit -p client/tsconfig.app.json`
2. **Test manually**: verify your change works in both dark and light mode
3. **No console.log**: remove all debug logging

### PR Template

Your PR should target the `develop` branch and include:
- Clear description of what changed and why
- Screenshot for UI changes
- List of tested scenarios

### Review Process

1. Submit PR against `develop`
2. Maintainer reviews
3. Address feedback
4. Squash and merge

## Releases

Releases happen when `develop` is merged into `main`:
1. Version bumped in `package.json` (root, server, client)
2. Merge develop → main
3. GitHub Actions automatically: builds, tests, pushes Docker images, creates GitHub Release + tag

## Project Structure

See [CLAUDE.md](CLAUDE.md) for detailed architecture and [SPECS.md](SPECS.md) for API contracts.

## Need Help?

- Open an [issue](https://github.com/ZlatanOmerovic/firebird-web-client/issues) for bugs or feature requests
- Check [TODO.md](TODO.md) for planned work
- Read [DOCKER.md](DOCKER.md) for deployment questions

---

Thank you for contributing!
