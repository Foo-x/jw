# jj integration

| ID | EARS |
| --- | --- |
| CC-JJ-01 | The jw CLI SHALL require the `jj` command on `PATH` and the Bun runtime. |
| CC-JJ-02 | The jw CLI SHALL use jj as the source of truth for which workspaces exist, via `jj workspace list`. |
| CC-JJ-03 | The jw CLI SHALL parse each line of `jj workspace list` as `<workspace name>: <change id> <commit id> ...`, taking the text before the first `:` as the name and the first token after it as the change ID. |
| CC-JJ-04 | The jw CLI SHALL ignore lines of `jj workspace list` that have no name before the `:`. |

## Rationale

- CC-JJ-02: Registrations in jj and directories on disk can diverge; comparing both is what enables `list` markers and `clean`.
- CC-JJ-03: jw depends on jj's human-readable output format, so a change of that format in jj is a compatibility risk.
