# `jw init`

Creates the `.jwconfig` file.

## Normal cases

### INIT-N-01: Create the config file with defaults

- **User story**: As a developer, I want to generate `.jwconfig` with default values, so that I can start customizing jw without writing the file from scratch.
- **Rationale**: A ready-made file documents the available fields and avoids syntax mistakes.
- **EARS**: WHEN the user runs `jw init` in a jj repository and `.jwconfig` does not exist, the jw CLI SHALL create `.jwconfig` containing `copyFiles: []`, `postCreateCommands: []` and `workspacesDirSuffix: "__ws"` as JSON, and print `Initialized jw config: <path>`.

### INIT-N-02: Create the config file at the default workspace root

- **User story**: As a developer, I want `.jwconfig` to be created at the default workspace root even when I run `jw init` from another workspace, so that all workspaces share a single config.
- **Rationale**: The config is always loaded from the default workspace ([configuration](../cross_cutting/configuration.md)); a file created elsewhere would never be read.
- **EARS**: WHEN the user runs `jw init` from a non-default workspace, the jw CLI SHALL create `.jwconfig` in the default workspace root.

## Error cases

### INIT-E-01: Not inside a jj repository

- **User story**: As a developer, if I run `jw init` outside a jj repository, I want a clear error, so that I know the command needs a repository.
- **Rationale**: The config location is derived from the repository; there is no valid place to write the file.
- **EARS**: IF the current directory is not inside a jj repository, THEN the jw CLI SHALL print `Error: Not a jujutsu repository (or any of the parent directories)` to stderr, create no file, and exit with code 1.

### INIT-E-02: Config file already exists

- **User story**: As a developer, if `.jwconfig` already exists, I want `jw init` to leave it untouched, so that my customized settings are not lost.
- **Rationale**: Overwriting would silently discard user configuration.
- **EARS**: IF `.jwconfig` already exists in the default workspace root, THEN the jw CLI SHALL print `Error: Config file already exists: <path>` to stderr, keep the existing file unchanged, and exit with code 1.
