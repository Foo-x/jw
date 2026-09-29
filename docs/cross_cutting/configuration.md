# Configuration (`.jwconfig`)

| ID | EARS |
| --- | --- |
| CC-CONF-01 | The jw CLI SHALL read `.jwconfig` from the default workspace root, regardless of the current workspace. |
| CC-CONF-02 | The jw CLI SHALL interpret `.jwconfig` as a JSON object with the fields `copyFiles: string[]`, `postCreateCommands: string[]` and `workspacesDirSuffix?: string`. |
| CC-CONF-03 | IF `.jwconfig` does not exist, THEN the jw CLI SHALL use the defaults `copyFiles: []`, `postCreateCommands: []` and suffix `__ws`, without printing anything. |
| CC-CONF-04 | IF `.jwconfig` is not valid JSON or cannot be read, THEN the jw CLI SHALL print `Failed to load config file: <error>` to stderr and continue with the defaults. |
| CC-CONF-05 | IF the parsed content is not an object, THEN the jw CLI SHALL use the defaults. |
| CC-CONF-06 | IF `copyFiles` or `postCreateCommands` is not an array of strings, THEN the jw CLI SHALL use the default (`[]`) for that field only. |
| CC-CONF-07 | IF `workspacesDirSuffix` is not a string or is an empty string, THEN the jw CLI SHALL use `__ws`. |
| CC-CONF-08 | The jw CLI SHALL ignore unknown fields. |

## Rationale

- CC-CONF-01: A single config shared by all workspaces avoids drift.
- CC-CONF-03 to 07: The config is optional and hand-edited; a mistake in one field or the file must not block workspace operations.
