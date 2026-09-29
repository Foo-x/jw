# `jw this`

Points the default workspace at the revision of the current workspace.

## Normal cases

### THIS-N-01: Switch the default workspace to the current workspace's revision

- **User story**: As a developer, I want the default workspace to check out the change I am working on in another workspace, so that I can inspect or run it in the main workspace.
- **Rationale**: Synchronizing manually requires looking up the change ID and running `jj edit` in the default workspace.
- **EARS**: WHEN the user runs `jw this` from a non-default workspace, the jw CLI SHALL look up the change ID of the current workspace in `jj workspace list`, run `jj edit <change id>` in the default workspace directory, and print `Switched default workspace to "<name>" (<change id>)`.

## Error cases

### THIS-E-01: Run from the default workspace

- **User story**: As a developer, if I run `jw this` in the default workspace, I want an error, so that I understand the command is meaningless there.
- **Rationale**: Switching the default workspace to itself does nothing.
- **EARS**: IF the current workspace is the default workspace, THEN the jw CLI SHALL print `Error: Cannot run 'jw this' from default workspace` to stderr and exit with code 1.

### THIS-E-02: `jj workspace list` fails

- **User story**: As a developer, if jj cannot list workspaces, I want to see the jj error, so that I can diagnose it.
- **Rationale**: The change ID comes from jj.
- **EARS**: IF `jj workspace list` exits with a non-zero code, THEN the jw CLI SHALL print an error that includes jj's stderr to stderr and exit with code 1.

### THIS-E-03: Current workspace is not registered in jj

- **User story**: As a developer, if the current directory name does not match a jj workspace, I want a clear error, so that I can tell why the change ID was not found.
- **Rationale**: The current workspace name is derived from the directory name, which can differ from the registered name.
- **EARS**: IF the current workspace name is not found in the `jj workspace list` output, THEN the jw CLI SHALL print `Error: Current workspace "<name>" not found in jj workspace list` to stderr and exit with code 1.

### THIS-E-04: `jj edit` fails

- **User story**: As a developer, if jj cannot edit the revision, I want to see the jj error, so that I can resolve it.
- **Rationale**: jj may refuse, e.g. for immutable revisions.
- **EARS**: IF `jj edit` exits with a non-zero code, THEN the jw CLI SHALL print an error that includes jj's stderr to stderr and exit with code 1.
