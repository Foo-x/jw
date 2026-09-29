# `jw clean`

Forgets workspaces whose directories no longer exist.

## Normal cases

### CLEAN-N-01: Forget stale workspaces

- **User story**: As a developer, I want jj registrations of deleted workspaces removed in bulk, so that `jj workspace list` no longer shows dead entries.
- **Rationale**: Deleting a workspace directory by hand leaves a stale jj registration.
- **EARS**: WHEN the user runs `jw clean`, the jw CLI SHALL run `jj workspace forget <name>` for each workspace known to jj, other than `default`, whose resolved directory does not exist, and print `Forgotten workspaces:` followed by each forgotten name indented by two spaces.

### CLEAN-N-02: Nothing to clean

- **User story**: As a developer, I want to be told when nothing was cleaned, so that I know the command ran correctly.
- **Rationale**: Silence would be ambiguous.
- **EARS**: WHEN no workspace was forgotten, the jw CLI SHALL print `No stale workspaces found`.

### CLEAN-N-03: Existing workspaces and default are kept

- **User story**: As a developer, I want workspaces that still exist to be left alone, so that `jw clean` is safe to run at any time.
- **Rationale**: Only dead registrations should be affected.
- **EARS**: WHILE a workspace directory exists or the workspace is `default`, the jw CLI SHALL NOT forget it.

## Error cases

### CLEAN-E-01: `jj workspace forget` fails for a workspace

- **User story**: As a developer, if forgetting one workspace fails, I want a warning while the others are still processed, so that one failure does not block cleanup.
- **Rationale**: Entries are independent.
- **EARS**: IF `jj workspace forget <name>` exits with a non-zero code, THEN the jw CLI SHALL print a warning that includes the workspace name and jj's stderr, exclude it from the forgotten list, and continue.

### CLEAN-E-02: `jj workspace list` fails

- **User story**: As a developer, if jj cannot list workspaces, I want to see the jj error, so that I can diagnose it.
- **Rationale**: The candidates come from jj.
- **EARS**: IF `jj workspace list` exits with a non-zero code, THEN the jw CLI SHALL print an error that includes jj's stderr to stderr and exit with code 1.
