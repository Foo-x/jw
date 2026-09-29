# `jw copy <name>`

Copies the files configured in `copyFiles` into an existing workspace.

## Normal cases

### COPY-N-01: Copy configured files to a workspace

- **User story**: As a developer, I want to re-copy configured files into an existing workspace, so that it picks up changes (e.g. an updated `.env`) made after creation.
- **Rationale**: Files are copied only at creation by `jw new` ([NEW-N-05](./new.md)); this covers later synchronization.
- **EARS**: WHEN the user runs `jw copy <name>` and the workspace directory exists, the jw CLI SHALL copy each path in `copyFiles` from the repository root of the current workspace into the workspace, and print `Copying files to workspace "<name>"...` and `Copy completed`.

### COPY-N-02: Normalize the workspace name

- **User story**: As a developer, I want to pass the name I gave to `jw new`, so that I do not need the normalized form.
- **Rationale**: Consistent with [NEW-N-04](./new.md).
- **EARS**: WHEN the name contains `/`, the jw CLI SHALL replace every `/` with `-` before use.

## Error cases

### COPY-E-01: Workspace name is missing

- **User story**: As a developer, if I omit the name, I want to see the usage, so that I can correct the command.
- **Rationale**: A target is required.
- **EARS**: IF no workspace name is given, THEN the jw CLI SHALL print `Error: Please specify a workspace name` followed by `Usage: jw copy <name>` to stderr and exit with code 1.

### COPY-E-02: Workspace does not exist

- **User story**: As a developer, if the workspace does not exist, I want an error, so that files are not copied to a wrong location.
- **Rationale**: The destination must exist.
- **EARS**: IF the workspace directory does not exist, THEN the jw CLI SHALL print `Error: Workspace "<name>" not found` to stderr and exit with code 1.

### COPY-E-03: A file to copy does not exist

- **User story**: As a developer, if a configured file is missing, I want a warning while other files are still copied, so that one stale entry does not block the rest.
- **Rationale**: Same policy as [NEW-E-04](./new.md).
- **EARS**: IF a path in `copyFiles` does not exist in the repository root, THEN the jw CLI SHALL print `Source does not exist: <path>` as a warning, skip that entry, and continue.
