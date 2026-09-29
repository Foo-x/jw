# CLI conventions

| ID | EARS |
| --- | --- |
| CC-CLI-01 | The jw CLI SHALL take the form `jw <command> [arguments]`, dispatching on the first argument. |
| CC-CLI-02 | IF a required argument is missing, THEN the jw CLI SHALL print `Error: Please specify a <argument name>` and `Usage: <usage>` on the next line to stderr, and exit with code 1. |
| CC-CLI-03 | The jw CLI SHALL print machine-consumable results (workspace path, version, completion script) alone on stdout. |
| CC-CLI-04 | The jw CLI SHALL print human-oriented progress and summary messages (`Creating workspace ...`, `Removed workspace ...`) to stdout. |
| CC-CLI-05 | The jw CLI SHALL NOT prompt interactively. |

## Rationale

- CC-CLI-03: Supports `cd $(jw go <name>)` and `source <(jw completion bash)`.
- CC-CLI-05: The tool is scriptable; every input comes from arguments and `.jwconfig`.
