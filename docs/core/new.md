# `jw new <name> [-r <revision>]`

Creates a new workspace.

## Normal cases

### NEW-N-01: Create a workspace

- **User story**: As a developer, I want to create a workspace with a single command, so that I can work on another change in parallel without manually managing directories.
- **Rationale**: `jj workspace add` requires choosing a path by hand; jw places workspaces at a predictable location ([workspace path resolution](../cross_cutting/workspace-path-resolution.md)).
- **EARS**: WHEN the user runs `jw new <name>` and no workspace directory exists for the name, the jw CLI SHALL run `jj workspace add --name <name> <workspace path>`, and print `Created workspace "<name>": <workspace path>`.

### NEW-N-02: Create the workspaces directory on demand

- **User story**: As a developer, I want the parent directory of workspaces to be created automatically, so that my first `jw new` works without preparation.
- **Rationale**: The workspaces directory does not exist until the first workspace is created.
- **EARS**: WHEN the workspaces directory does not exist, the jw CLI SHALL create it (including parents) before running `jj workspace add`.

### NEW-N-03: Create from a specified revision

- **User story**: As a developer, I want to base a new workspace on a specific revision, so that I can start working from an arbitrary point in history.
- **Rationale**: Without this, the new workspace always starts from the default `jj workspace add` revision.
- **EARS**: WHEN the user runs `jw new <name> -r <revision>` (or `--revision <revision>`), in any position after `new`, the jw CLI SHALL pass `--revision <revision>` to `jj workspace add`.

### NEW-N-04: Normalize the workspace name

- **User story**: As a developer, I want names such as `feature/foo` to be usable, so that I can reuse branch-like names without creating nested directories.
- **Rationale**: A `/` in a name would create nested directories and an ambiguous jj workspace name.
- **EARS**: WHEN the workspace name contains `/`, the jw CLI SHALL replace every `/` with `-` and use the result as both the jj workspace name and the directory name.

### NEW-N-05: Copy configured files

- **User story**: As a developer, I want files such as local env files copied into the new workspace, so that it is usable immediately.
- **Rationale**: Untracked files (e.g. `.env`) are not present in a fresh workspace.
- **EARS**: WHEN the workspace is created, the jw CLI SHALL copy each path in `copyFiles` from the repository root of the current workspace into the new workspace, printing `Copying "<file>"...` for each.

### NEW-N-06: Run post-create commands

- **User story**: As a developer, I want setup commands (e.g. dependency install) to run automatically, so that the new workspace is ready to use.
- **Rationale**: Repetitive setup steps are error-prone when done by hand.
- **EARS**: WHEN file copying has finished, the jw CLI SHALL run each entry of `postCreateCommands` in order, with the new workspace as the working directory, printing `Running command: <command>` for each. Each entry is split on spaces and executed without a shell.

## Error cases

### NEW-E-01: Workspace name is missing

- **User story**: As a developer, if I omit the workspace name, I want to see the usage, so that I can correct the command.
- **Rationale**: A name is required to determine the workspace path.
- **EARS**: IF no workspace name is given, THEN the jw CLI SHALL print `Error: Please specify a workspace name` followed by `Usage: jw new <name> [-r <revision>]` to stderr and exit with code 1.

### NEW-E-02: Workspace already exists

- **User story**: As a developer, if a workspace with the same name already exists, I want creation to be refused, so that existing work is not overwritten.
- **Rationale**: Reusing an existing directory could corrupt or mix workspaces.
- **EARS**: IF the workspace path already exists, THEN the jw CLI SHALL print `Error: Workspace "<name>" already exists` to stderr, make no changes, and exit with code 1.

### NEW-E-03: `jj workspace add` fails

- **User story**: As a developer, if jj fails to create the workspace, I want the jj error shown and no follow-up steps run, so that files are not copied into a broken workspace.
- **Rationale**: Copying and commands assume the workspace exists.
- **EARS**: IF `jj workspace add` exits with a non-zero code (e.g. invalid revision), THEN the jw CLI SHALL print an error that includes jj's stderr to stderr, skip file copying and post-create commands, and exit with code 1.

### NEW-E-04: A file to copy does not exist

- **User story**: As a developer, if a path in `copyFiles` is missing, I want a warning but continued setup, so that one stale entry does not block workspace creation.
- **Rationale**: The workspace has already been created; aborting would leave it half-configured.
- **EARS**: IF a path in `copyFiles` does not exist in the repository root, THEN the jw CLI SHALL print `Source does not exist: <path>` as a warning, skip that entry, and continue.

### NEW-E-05: A post-create command fails

- **User story**: As a developer, if a setup command fails, I want to see why but still get the workspace, so that I can fix the problem manually.
- **Rationale**: The workspace is already created and usable; later commands may be independent.
- **EARS**: IF a command in `postCreateCommands` exits with a non-zero code, THEN the jw CLI SHALL print `Command failed: <command>` and its stderr as warnings, continue with the remaining commands, and finish with exit code 0.
