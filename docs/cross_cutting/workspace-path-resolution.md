# Workspace path resolution

Rules for locating workspaces, shared by all commands.

| ID | EARS |
| --- | --- |
| CC-PATH-01 | The jw CLI SHALL determine the default workspace root from any workspace of the repository, without configuration. |
| CC-PATH-02 | The jw CLI SHALL place non-default workspaces at `<parent of default workspace>/<default workspace directory name><suffix>/<name>` as absolute paths. |
| CC-PATH-03 | The jw CLI SHALL use `__ws` as `<suffix>` unless `workspacesDirSuffix` is set in `.jwconfig`. |
| CC-PATH-04 | The jw CLI SHALL replace every `/` in a user-supplied workspace name with `-` before resolving paths or calling jj. |
| CC-PATH-05 | The jw CLI SHALL treat the name `default` as the default workspace, whose path is the default workspace root rather than a path under the workspaces directory. |
| CC-PATH-06 | The jw CLI SHALL derive the current workspace name from the base name of the current workspace root, or `default` when it is the default workspace. |
| CC-PATH-07 | IF the name after `/` replacement is empty, `.` or `..`, THEN the jw CLI SHALL print `Error: Invalid workspace name: "<name>"` to stderr, change nothing, and exit with code 1. |

## Rationale

- CC-PATH-01: jj workspaces share one repository store held by the default workspace, so any workspace can locate the default one.
- CC-PATH-02: A sibling directory keeps workspaces outside the repository tree, so they are not picked up by the default workspace's tooling. Absolute paths keep results valid from any working directory.
- CC-PATH-04: A `/` would otherwise create nested directories.
- CC-PATH-07: `.` and `..` survive normalization and resolve outside the workspaces directory; `jw rm ..` would recursively delete the parent of the default workspace.
- CC-PATH-06: Directory name and jj workspace name are assumed to match, which holds for workspaces created by jw. Renaming a directory outside jw breaks this (see [THIS-E-03](../core/this.md)).
