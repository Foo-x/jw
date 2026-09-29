# `jw version`

Shows the version.

## Normal cases

### VERSION-N-01: Print the version

- **User story**: As a developer, I want to check the installed jw version, so that I can report issues and confirm upgrades.
- **Rationale**: The version identifies the behavior described in these specs.
- **EARS**: WHEN the user runs `jw version`, `jw --version` or `jw -v`, the jw CLI SHALL print the `version` from `package.json` to stdout and exit with code 0.

## Error cases

None. The command does not depend on a repository or external commands.
