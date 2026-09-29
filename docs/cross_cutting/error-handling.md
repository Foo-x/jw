# Error handling

| ID | EARS |
| --- | --- |
| CC-ERR-01 | IF a command throws an error derived from `JwError`, THEN the jw CLI SHALL print `Error: <message>` to stderr and exit with code 1. |
| CC-ERR-02 | IF a command throws any other error, THEN the jw CLI SHALL print `Unexpected error: <error>` to stderr and exit with code 1. |
| CC-ERR-03 | WHEN a command completes, or handles a non-fatal problem, the jw CLI SHALL exit with code 0. |
| CC-ERR-04 | WHEN a problem does not prevent the command's main purpose (e.g. missing copy source, failed post-create command, failed `jj workspace forget` during `rm`/`clean`), the jw CLI SHALL print a warning to stderr and continue. |
| CC-ERR-05 | The jw CLI SHALL NOT print results (e.g. paths) to stdout when a command fails. |

## Rationale

- CC-ERR-01/02: Distinguishing expected errors from bugs keeps user-facing messages clean while still exposing unexpected failures.
- CC-ERR-04: When the desired end state can still be reached, aborting would leave more work for the user.
- CC-ERR-05: Commands like `jw go` are consumed by `$(...)`; stdout must contain only valid output.
