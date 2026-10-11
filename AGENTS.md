# AGENTS.md

This file provides guidance to AI Agent when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun run lint         # Lint with Biome
bun run format       # Format with Biome
bun run test         # Run tests
bun run test:c       # Run tests and output coverage
bunx tsc --noEmit    # Type check
bun run src/index.ts # Run the CLI directly
```

Read CLI commands from README.md.

Running a single test file:
```bash
bun run test src/__tests__/infrastructure/config-repository.test.ts
```

## Architecture

A CLI tool for managing jujutsu (jj) workspaces. Runtime is Bun with no external dependencies.

### Module layout

```
index.ts                  → CLI entry point and composition root. Parses arguments, builds `Deps` from the infrastructure adapters, dispatches commands via switch.
controller/               → Imperative shell. Talks to the outside world through ports.
  workspace.ts            → Per-command orchestration (new/list/go/rm/rename/copy/clean/init/this/use): read → decide → act.
  ports.ts                → Interfaces for external I/O: Jujutsu, FileSystem, CommandRunner, ConfigRepository, Deps.
  errors.ts               → Port-related exceptions (jj command failure, not a jj repo).
infrastructure/           → Adapters implementing the ports.
  process.ts              → CommandRunner (Bun.spawn).
  jj.ts                   → Jujutsu (jj CLI, `.jj/repo` resolution, output parsing).
  file-system.ts          → FileSystem (node:fs, cp/mv/rm/mkdir).
  config-repository.ts    → ConfigRepository (.jwconfig file I/O).
  constants.ts            → File names.
application/
  workspace.ts            → Pure command-level decisions. Takes the results of I/O (paths, existence flags, change ids, config) and returns locations, plans, display lines, or throws rule violations.
domain/                   → Pure business rules.
  workspace.ts            → Name normalization, path resolution, rm/rename/use/this guards, default names.
  config.ts               → Config type, defaults, and parsing/validation.
  errors.ts               → JwError base class and rule-violation exceptions.
```

Dependencies point inward: `index.ts → controller/infrastructure`, `infrastructure → controller (ports, errors)`, `controller → application → domain`.

- `domain/` and `application/` are pure: no `node:fs`, `Bun`, `process`, `console`, and no imports from outer layers. `domain/` may import only `node:path` and other `domain/` files.
- `controller/` reaches the outside world only through ports (no `node:fs`, `Bun`, `process`, or `infrastructure/`). `console` output is allowed.
- Biome enforces these via `overrides` in `biome.json`.
- Pass the results of I/O into `application/` instead of letting it call out. Reads that depend on a previous decision stay in `controller/`.

### Data flow

1. `index.ts` builds `Deps` and delegates the command to the corresponding function in `controller/workspace.ts`
2. The controller reads facts via `deps` (paths, config, existence, change ids), passes them to `application/` (which applies `domain/` rules), then acts on the result via `deps.jj` / `deps.fs` / `deps.runner`
3. Errors are classified as custom exceptions from `domain/errors.ts` and `controller/errors.ts` and caught uniformly in `index.ts` for display

### Workspace path resolution

- Default workspace: if `.jj/repo` is a directory, the current location is the default workspace; if it is a file, the default workspace is two parent directories up from the path it contains
- Other workspaces live under `<parent of default workspace>/<repo name><suffix>/`
- `suffix` defaults to `__ws`, configurable via `workspacesDirSuffix` in `.jwconfig`
- Forward slashes `/` in workspace names are automatically converted to `-`

### .jwconfig fields

- `copyFiles: string[]` — Files/directories to copy into a new workspace on creation
- `postCreateCommands: string[]` — Commands to run inside the new workspace after creation
- `workspacesDirSuffix?: string` — Suffix for the workspaces parent directory

## Tests

Tests live in `src/__tests__/` (mirroring the source layout) and use `vitest`.
`domain/` and `application/` are tested as pure functions; controllers with fake `Deps`; adapters with mocked `node:fs` / `Bun`.
Real jj workspace operations are not covered by automated tests.

## Lint / Format

Uses Biome (in place of prettier and eslint). Configuration is in `biome.json`.
2-space indentation, double quotes, semicolons.

## Language

All code and comments must be written in English.
