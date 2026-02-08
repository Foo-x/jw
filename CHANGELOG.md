# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-08

### Added
- `jw this` - Switch default workspace to current workspace's revision

## [0.2.0] - 2026-02-04

### Added
- `workspacesDirSuffix` configuration option in `.jwconfig`

### Changed
- **BREAKING**: Default `workspacesDirSuffix` changed to `__ws` (was empty string)
- **BREAKING**: `workspaces` field is no longer stored in `.jwconfig`

## [0.1.0] - 2026-01-24

### Added
- Initial implementation of jw CLI
- `jw init` - Initialize configuration file
- `jw new <name> [-r <revision>]` - Create workspace
- `jw list` - List workspaces
- `jw go <name>` - Output workspace path
- `jw rm <name>` - Remove workspace (with default workspace protection)
- `jw rename <old> <new>` - Rename workspace
- `jw copy <name>` - Copy files from default workspace
- `jw clean` - Remove non-existent workspaces from configuration
- `jw completion bash` - Bash completion
- `.jwconfig` configuration file support
- Unit tests
- Custom error classes
- Type-safe configuration parsing
- MIT License

### Fixed
- List output issue when not in default workspace

[0.3.0]: https://github.com/Foo-x/jw/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Foo-x/jw/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Foo-x/jw/releases/tag/v0.1.0
