# jw - jujutsu workspace management CLI

A CLI tool for easily managing jujutsu workspaces.

## Installation

```bash
bun i -g github:foo-x/jw
```

This makes the `jw` command available globally.

## Usage

### Create a new workspace

```bash
jw new <name>
```

- Any `/` in the name is automatically converted to `-`
- The workspace is created in `../<repo>__ws/<name>` directory
- Files specified in `.jwconfig` are copied
- Commands specified in `.jwconfig` are executed

### List workspaces

```bash
jw list
```

### Output workspace path

```bash
jw go <name>
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
- Removes the workspace from the config file

### Copy files to a workspace

```bash
jw copy <name>
```

Copies files specified in `.jwconfig` from the default workspace to the specified workspace.

### Remove non-existent workspaces from config

```bash
jw clean
```

## Configuration File (.jwconfig)

Create a `.jwconfig` file in the project root:

```json
{
  "workspaces": [],
  "copyFiles": [".env", "node_modules", ".vscode"],
  "postCreateCommands": ["bun install"]
}
```

- `workspaces`: List of managed workspaces (automatically updated)
- `copyFiles`: Files/directories to copy when creating a workspace
- `postCreateCommands`: Commands to run after creating a workspace

## Development

```bash
bun install
bun link
jw <command>
```

## License

MIT
