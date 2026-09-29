# `jw go [name]`

Prints the path of a workspace.

## Normal cases

### GO-N-01: Print a workspace path

- **User story**: As a developer, I want the path of a workspace on stdout, so that I can use it with `cd $(jw go <name>)`.
- **Rationale**: A CLI cannot change the parent shell's directory; printing only the path makes it composable.
- **EARS**: WHEN the user runs `jw go <name>` and the workspace directory exists, the jw CLI SHALL print only the workspace path to stdout.

### GO-N-02: Default workspace

- **User story**: As a developer, I want `jw go` without arguments to take me to the default workspace, so that returning to the main workspace is short.
- **Rationale**: The default workspace lives outside the workspaces directory and needs special resolution.
- **EARS**: WHEN the user runs `jw go` with no name, or with the name `default`, the jw CLI SHALL print the default workspace path.

### GO-N-03: Normalize the workspace name

- **User story**: As a developer, I want to pass the same name I gave to `jw new` (including `/`), so that I do not have to remember the normalized form.
- **Rationale**: Names are normalized at creation ([NEW-N-04](./new.md)); lookups must match.
- **EARS**: WHEN the name contains `/`, the jw CLI SHALL replace every `/` with `-` before resolving the path.

## Error cases

### GO-E-01: Workspace does not exist

- **User story**: As a developer, if the workspace directory does not exist, I want an error rather than a bogus path, so that `cd $(jw go ...)` does not go somewhere unexpected.
- **Rationale**: An error message on stdout would be consumed by `cd`.
- **EARS**: IF the workspace directory does not exist, THEN the jw CLI SHALL print `Error: Workspace "<name>" not found` to stderr, print nothing to stdout, and exit with code 1.
