# jw - jujutsu workspace management CLI

A CLI tool for easily managing jujutsu workspaces.

## Requirements

- [Bun](https://bun.sh/) runtime
- [Jujutsu (jj)](https://github.com/martinvonz/jj) and a jj repository

## Installation

```bash
bun i -g github:foo-x/jw
```

This makes the `jw` command available globally.

## Usage

### Initialize configuration

```bash
jw init
```

Creates `.jwconfig` in the repository root.

### Create a new workspace

```bash
jw new <name> [-r <revision>]
```

- Any `/` in the name is automatically converted to `-`
- The workspace is created in `<parent of default>/<repo><suffix>/<name>` (suffix defaults to `__ws`)
- Files specified in `.jwconfig` are copied
- Commands specified in `.jwconfig` are executed

### List workspaces

```bash
jw list
```

### Output workspace path

```bash
jw go [name]
```

Can be used with shell's cd command:

```bash
cd $(jw go <name>)
```

### Remove a workspace

```bash
jw rm <name>
```

- Runs `jj workspace forget`
- Deletes the workspace directory

### Rename a workspace

```bash
jw rename <old> <new>
```

### Copy files to a workspace

```bash
jw copy <name>
```

Copies files specified in `.jwconfig` from the default workspace to the specified workspace.

### Remove non-existent workspaces from config

```bash
jw clean
```

### Shell completion (bash)

```bash
source <(jw completion bash)
```

## Configuration File (.jwconfig)

Create a `.jwconfig` file in the project root:

```json
{
  "copyFiles": [],
  "postCreateCommands": [],
  "workspacesDirSuffix": "__ws"
}
```

- `copyFiles`: Files/directories to copy when creating a workspace
- `postCreateCommands`: Commands to run after creating a workspace
- `workspacesDirSuffix`: Suffix for the workspaces parent directory (optional)

## Development

```bash
bun install
bun link
jw <command>
```

## License

MIT
