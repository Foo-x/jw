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
