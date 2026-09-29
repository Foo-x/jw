# `jw use <name>`

Points the default workspace at the revision of the specified workspace.

## Normal cases

### USE-N-01: Switch the default workspace to another workspace's revision

- **User story**: As a developer, I want the default workspace to check out the change of another workspace, so that I can inspect or run it in the main workspace without leaving it.
- **Rationale**: Counterpart of [`jw this`](./this.md) for use from the default workspace.
- **EARS**: WHEN the user runs `jw use <name>` from the default workspace, the jw CLI SHALL look up the change ID of `<name>` in `jj workspace list`, run `jj edit <change id>` in the default workspace directory, and print `Switched default workspace to "<name>" (<change id>)`.

### USE-N-02: Normalize the workspace name

- **User story**: As a developer, I want to pass the name I gave to `jw new`, so that I do not need the normalized form.
- **Rationale**: Consistent with [NEW-N-04](./new.md).
- **EARS**: WHEN the name contains `/`, the jw CLI SHALL replace every `/` with `-` before lookup.

## Error cases

### USE-E-01: Workspace name is missing

- **User story**: As a developer, if I omit the name, I want to see the usage, so that I can correct the command.
- **Rationale**: A target is required.
- **EARS**: IF no workspace name is given, THEN the jw CLI SHALL print `Error: Please specify a workspace name` followed by `Usage: jw use <name>` to stderr and exit with code 1.

### USE-E-02: The default workspace is specified

- **User story**: As a developer, if I pass `default`, I want an error, so that I do not run a no-op.
- **Rationale**: The default workspace cannot point at itself.
- **EARS**: IF the name is `default`, THEN the jw CLI SHALL print `Error: Cannot use the default workspace` to stderr and exit with code 1.

### USE-E-03: Run outside the default workspace

- **User story**: As a developer, if I run `jw use` from a non-default workspace, I want an error, so that the command's target is unambiguous.
- **Rationale**: The command edits the default workspace and is defined to run from it (see [`jw this`](./this.md) for the reverse).
- **EARS**: IF the current workspace is not the default workspace, THEN the jw CLI SHALL print `Error: This command can only be used in the default workspace` to stderr and exit with code 1.

### USE-E-04: Workspace is not registered in jj

- **User story**: As a developer, if the workspace does not exist, I want a not-found error, so that I notice a typo.
- **Rationale**: There is no change ID to edit.
- **EARS**: IF `<name>` is not found in the `jj workspace list` output, THEN the jw CLI SHALL print `Error: Workspace "<name>" not found` to stderr and exit with code 1.

### USE-E-05: `jj workspace list` fails

- **User story**: As a developer, if jj cannot list workspaces, I want to see the jj error, so that I can diagnose it.
- **Rationale**: The change ID comes from jj.
- **EARS**: IF `jj workspace list` exits with a non-zero code, THEN the jw CLI SHALL print an error that includes jj's stderr to stderr and exit with code 1.

### USE-E-06: `jj edit` fails

- **User story**: As a developer, if jj cannot edit the revision, I want to see the jj error, so that I can resolve it.
- **Rationale**: jj may refuse, e.g. for immutable revisions.
- **EARS**: IF `jj edit` exits with a non-zero code, THEN the jw CLI SHALL print an error that includes jj's stderr to stderr and exit with code 1.
