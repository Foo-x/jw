# `jw list`

Lists workspaces.

## Normal cases

### LIST-N-01: List all workspaces

- **User story**: As a developer, I want to see all workspaces with their paths, so that I can find where each one lives.
- **Rationale**: `jj workspace list` shows revisions but not directory locations.
- **EARS**: WHEN the user runs `jw list`, the jw CLI SHALL print the `default` workspace first as `  default (<path>)`, followed by one line `  <name> (<path>)` for each other workspace known to jj.

### LIST-N-02: Mark the current workspace

- **User story**: As a developer, I want the workspace I am in to be marked, so that I can tell where I am.
- **Rationale**: With several similarly named workspaces, the current one is easy to confuse.
- **EARS**: WHEN the path of a listed workspace equals the root of the current workspace, the jw CLI SHALL prefix that line with `*` instead of a space.

## Error cases

### LIST-E-01: Workspace directory is missing

- **User story**: As a developer, if a workspace is registered in jj but its directory is gone, I want it flagged, so that I can clean it up.
- **Rationale**: Directories may be deleted outside jw, leaving stale entries (see [clean](./clean.md)).
- **EARS**: IF a workspace known to jj has no directory at its resolved path, THEN the jw CLI SHALL print `  <name> ✗` instead of the path.

### LIST-E-02: `jj workspace list` fails

- **User story**: As a developer, if jj cannot list workspaces, I want to see the jj error, so that I can diagnose it.
- **Rationale**: The list of workspaces comes from jj.
- **EARS**: IF `jj workspace list` exits with a non-zero code, THEN the jw CLI SHALL print an error that includes jj's stderr to stderr and exit with code 1.

### LIST-E-03: Not inside a jj repository

- **User story**: As a developer, if I run `jw list` outside a repository, I want a clear error, so that I know why nothing is listed.
- **Rationale**: Workspace paths are derived from the repository.
- **EARS**: IF the current directory is not inside a jj repository, THEN the jw CLI SHALL print `Error: Not a jujutsu repository (or any of the parent directories)` to stderr and exit with code 1.
