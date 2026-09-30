# `jw rename <old> <new>`

Renames a workspace.

## Normal cases

### RENAME-N-01: Rename a workspace

- **User story**: As a developer, I want to rename a workspace and its directory together, so that the name in jj and the path stay consistent.
- **Rationale**: jw derives paths from names; renaming only one side breaks lookups.
- **EARS**: WHEN the user runs `jw rename <old> <new>`, the old workspace directory exists, and the new workspace directory does not, the jw CLI SHALL run `jj workspace rename <new>` with the old workspace directory as the working directory, move the directory to the new path, and print `Renamed workspace "<old>" to "<new>"`.

### RENAME-N-02: Normalize names

- **User story**: As a developer, I want `/` in either name to be handled like in `jw new`, so that naming is consistent.
- **Rationale**: Consistent with [NEW-N-04](./new.md).
- **EARS**: WHEN either name contains `/`, the jw CLI SHALL replace every `/` with `-` before use.

## Error cases

### RENAME-E-01: Argument is missing

- **User story**: As a developer, if I omit a name, I want to see the usage, so that I can correct the command.
- **Rationale**: Both names are required.
- **EARS**: IF the old name is missing, THEN the jw CLI SHALL print `Error: Please specify a old workspace name`; IF the new name is missing, THEN it SHALL print `Error: Please specify a new workspace name`; in both cases followed by `Usage: jw rename <old> <new>` on stderr, with exit code 1.

### RENAME-E-02: Old workspace does not exist

- **User story**: As a developer, if the source workspace does not exist, I want an error, so that I notice a typo.
- **Rationale**: There is nothing to rename.
- **EARS**: IF the old workspace directory does not exist, THEN the jw CLI SHALL print `Error: Workspace "<old>" not found` to stderr and exit with code 1.

### RENAME-E-03: New workspace already exists

- **User story**: As a developer, if the target name is taken, I want the rename refused, so that an existing workspace is not overwritten.
- **Rationale**: Moving onto an existing directory would corrupt it.
- **EARS**: IF the new workspace directory already exists, THEN the jw CLI SHALL print `Error: Workspace "<new>" already exists` to stderr, make no changes, and exit with code 1.

### RENAME-E-04: `jj workspace rename` fails

- **User story**: As a developer, if jj cannot rename the workspace, I want the directory left untouched, so that names and paths stay consistent.
- **Rationale**: Moving the directory after a failed jj rename would desynchronize them.
- **EARS**: IF `jj workspace rename` exits with a non-zero code, THEN the jw CLI SHALL print an error that includes jj's stderr to stderr, not move the directory, and exit with code 1.

### RENAME-E-05: Renaming the default workspace

- **User story**: As a developer, if I try to rename the default workspace, I want it refused, so that the main repository is not moved.
- **Rationale**: The default workspace root holds the repository store and is not located under the workspaces directory.
- **EARS**: IF the old name is `default`, THEN the jw CLI SHALL print `Error: Cannot rename the default workspace` to stderr, change nothing, and exit with code 1.

### RENAME-E-06: Renaming the current workspace

- **User story**: As a developer, if I try to rename the workspace I am in, I want it refused, so that my shell is not left in a moved directory.
- **Rationale**: Moving the current directory leaves the shell at a path that no longer exists, and jw derives the current workspace name from that path ([CC-PATH-06](../cross_cutting/workspace-path-resolution.md)). Same policy as [RM-E-04](./rm.md).
- **EARS**: IF the old workspace path equals the root of the current workspace, THEN the jw CLI SHALL print `Error: Cannot rename the current workspace` to stderr, change nothing, and exit with code 1.
