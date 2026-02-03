# AGENTS.md

This file provides guidance to AI Agent when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun run lint         # Lint with Biome
bun run format       # Format with Biome
bun test             # Run tests
bun test --watch     # Run tests in watch mode
bunx tsc --noEmit    # Type check
bun run src/index.ts # Run the CLI directly
```

Running a single test file:
```bash
bun test src/__tests__/config.test.ts
```

## Architecture

A CLI tool for managing jujutsu (jj) workspaces. Runtime is Bun with no external dependencies.

### Module layout

```
index.ts        → CLI entry point. Parses arguments and dispatches commands via switch.
workspace.ts    → Business logic for all workspace operations (new/list/go/rm/rename/copy/clean/init).
config.ts       → Loading, parsing, and saving .jwconfig. Defines the Config interface.
utils.ts        → Low-level functions: jj command execution, path resolution, file operations.
errors.ts       → Custom exception classes extending JwError base class.
constants.ts    → App-wide constants (file names, default values, etc.).
```

### Data flow

1. `index.ts` receives a command and delegates to the corresponding function in `workspace.ts`
2. `workspace.ts` loads config via `config.ts`, then executes jj commands and file operations via `utils.ts`
3. Errors are classified as custom exceptions from `errors.ts` and caught uniformly in `index.ts` for display

### Workspace path resolution

- Default workspace: if `.jj/repo` is a directory, the current location is the default workspace; if it is a file, the default workspace is two parent directories up from the path it contains
- Other workspaces live under `<parent of default workspace>/<repo name><suffix>/`
- `suffix` defaults to `-workspaces`, configurable via `workspacesDirSuffix` in `.jwconfig`
- Forward slashes `/` in workspace names are automatically converted to `-`

### .jwconfig fields

- `copyFiles: string[]` — Files/directories to copy into a new workspace on creation
- `postCreateCommands: string[]` — Commands to run inside the new workspace after creation
- `workspacesDirSuffix?: string` — Suffix for the workspaces parent directory

## Tests

Only pure functions are unit-tested (`parseConfig`, `normalizeWorkspaceName`, `getWorkspacesDirName`).
Tests live in `src/__tests__/` and use `bun:test`.
Workspace operations require a jj repository and are not covered by automated tests.

## Lint / Format

Uses Biome (in place of prettier and eslint). Configuration is in `biome.json`.
2-space indentation, double quotes, semicolons.

## Language

All code and comments must be written in English.
