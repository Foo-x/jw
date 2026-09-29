# `jw completion <shell>`

Outputs a shell completion script.

## Normal cases

### COMPLETION-N-01: Output the bash completion script

- **User story**: As a developer, I want to load completion with `source <(jw completion bash)`, so that I can complete subcommands and workspace names.
- **Rationale**: Completion reduces typing and mistakes in workspace names.
- **EARS**: WHEN the user runs `jw completion bash`, the jw CLI SHALL print a bash completion script to stdout that completes subcommands, the options `-r`/`--revision` for `new`, workspace names from `jj workspace list` for `go`, `copy`, `rename`, `rm` and `use`, and `bash` for `completion`.

### COMPLETION-N-02: Exclude `default` where it is invalid

- **User story**: As a developer, I want `default` not to be suggested for `rm` and `use`, so that I am not offered targets that will be refused.
- **Rationale**: See [RM-E-02](./rm.md) and [USE-E-02](./use.md).
- **EARS**: WHEN completing the argument of `rm` or `use`, the completion script SHALL exclude the `default` workspace from the candidates.

## Error cases

### COMPLETION-E-01: Shell is missing

- **User story**: As a developer, if I omit the shell, I want to see the usage, so that I can correct the command.
- **Rationale**: The output depends on the shell.
- **EARS**: IF no shell is given, THEN the jw CLI SHALL print `Error: Please specify a shell` followed by `Usage: jw completion <shell>` to stderr and exit with code 1.

### COMPLETION-E-02: Unsupported shell

- **User story**: As a developer, if I specify an unsupported shell, I want to know which shells are supported, so that I can choose a valid one.
- **Rationale**: Only bash is implemented.
- **EARS**: IF the shell is not one of the supported shells (`bash`), THEN the jw CLI SHALL print `Error: Unsupported shell "<shell>"` followed by `Supported shells: bash` to stderr and exit with code 1.
