# `jw rm <name>`

Removes a workspace.

## Normal cases

### RM-N-01: Remove a workspace

- **User story**: As a developer, I want to delete a workspace in one step, so that both the jj registration and the directory are gone.
- **Rationale**: Deleting only the directory leaves a stale jj entry; forgetting only in jj leaves files on disk.
- **EARS**: WHEN the user runs `jw rm <name>`, the jw CLI SHALL run `jj workspace forget <name>`, then delete the workspace directory if it exists, and print `Removed workspace "<name>"`.

### RM-N-02: Directory already deleted

- **User story**: As a developer, I want `jw rm` to succeed even if the directory is already gone, so that I can use it to clean up stale workspaces.
- **Rationale**: Directories may be deleted outside jw.
- **EARS**: WHEN the workspace directory does not exist, the jw CLI SHALL skip directory deletion, still run `jj workspace forget`, and finish successfully.

### RM-N-03: Normalize the workspace name

- **User story**: As a developer, I want to pass the same name I gave to `jw new`, so that I do not need the normalized form.
- **Rationale**: Consistent with [NEW-N-04](./new.md).
- **EARS**: WHEN the name contains `/`, the jw CLI SHALL replace every `/` with `-` before use.

## Error cases

### RM-E-01: Workspace name is missing

- **User story**: As a developer, if I omit the name, I want to see the usage, so that I do not remove anything by accident.
- **Rationale**: A target is required.
- **EARS**: IF no workspace name is given, THEN the jw CLI SHALL print `Error: Please specify a workspace name` followed by `Usage: jw rm <name>` to stderr and exit with code 1.

### RM-E-02: Removing the default workspace

- **User story**: As a developer, if I try to remove the default workspace, I want it refused, so that the main repository is never deleted.
- **Rationale**: The default workspace holds the repository store; deleting it destroys all workspaces.
- **EARS**: IF the name is `default`, THEN the jw CLI SHALL print `Error: Cannot remove the default workspace` to stderr, change nothing, and exit with code 1.

### RM-E-03: `jj workspace forget` fails

- **User story**: As a developer, if jj cannot forget the workspace (e.g. it is unknown to jj), I want the directory left untouched and the jj error shown, so that a directory that is not a jj workspace is never deleted.
- **Rationale**: A failed forget means jw cannot confirm the directory is a registered workspace; the directory may hold unrelated data (e.g. one created by hand under the workspaces directory). Deleting it would be unrecoverable data loss, while leftovers can be removed manually.
- **EARS**: IF `jj workspace forget` exits with a non-zero code, THEN the jw CLI SHALL print an error that includes jj's stderr to stderr, not delete the directory, and exit with code 1.

### RM-E-04: Removing the current workspace

- **User story**: As a developer, if I try to remove the workspace I am in, I want it refused, so that my shell is not left in a deleted directory.
- **Rationale**: Deleting the current directory breaks subsequent commands run from it.
- **EARS**: IF the workspace path equals the root of the current workspace, THEN the jw CLI SHALL print `Error: Cannot remove the current workspace` to stderr, change nothing, and exit with code 1.
