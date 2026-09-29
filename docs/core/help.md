# `jw help`

Shows usage, and handles unknown commands.

## Normal cases

### HELP-N-01: Show help

- **User story**: As a developer, I want to list the available commands, so that I can recall syntax without opening the README.
- **Rationale**: Discoverability of the CLI.
- **EARS**: WHEN the user runs `jw help`, `jw --help` or `jw -h`, the jw CLI SHALL print the usage of all commands to stdout and exit with code 0.

### HELP-N-02: Show help when no command is given

- **User story**: As a developer, I want plain `jw` to show help, so that I get guidance instead of an error.
- **Rationale**: Running the bare command usually means exploring.
- **EARS**: WHEN the user runs `jw` with no arguments, the jw CLI SHALL print the usage of all commands to stdout and exit with code 0.

## Error cases

### HELP-E-01: Unknown command

- **User story**: As a developer, if I mistype a command, I want an error naming it, so that I can correct it.
- **Rationale**: Silently ignoring or guessing could run the wrong operation.
- **EARS**: IF the first argument is not a known command, THEN the jw CLI SHALL print `Error: Unknown command "<command>"` to stderr and exit with code 1.
