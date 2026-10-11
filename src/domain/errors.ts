export class JwError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwError";
  }
}

export class WorkspaceExistsError extends JwError {
  constructor(name: string) {
    super(`Workspace "${name}" already exists`);
    this.name = "WorkspaceExistsError";
  }
}

export class WorkspaceNotFoundError extends JwError {
  constructor(name: string) {
    super(`Workspace "${name}" not found`);
    this.name = "WorkspaceNotFoundError";
  }
}

export class ValidationError extends JwError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class CannotRemoveDefaultWorkspaceError extends JwError {
  constructor() {
    super("Cannot remove the default workspace");
    this.name = "CannotRemoveDefaultWorkspaceError";
  }
}

export class CannotRemoveCurrentWorkspaceError extends JwError {
  constructor() {
    super("Cannot remove the current workspace");
    this.name = "CannotRemoveCurrentWorkspaceError";
  }
}

export class CannotRenameDefaultWorkspaceError extends JwError {
  constructor() {
    super("Cannot rename the default workspace");
    this.name = "CannotRenameDefaultWorkspaceError";
  }
}

export class CannotRenameCurrentWorkspaceError extends JwError {
  constructor() {
    super("Cannot rename the current workspace");
    this.name = "CannotRenameCurrentWorkspaceError";
  }
}

export class InvalidWorkspacesDirSuffixError extends JwError {
  constructor(suffix: string) {
    super(`Invalid workspacesDirSuffix: "${suffix}"`);
    this.name = "InvalidWorkspacesDirSuffixError";
  }
}

export class InvalidWorkspaceNameError extends JwError {
  constructor(name: string) {
    super(`Invalid workspace name: "${name}"`);
    this.name = "InvalidWorkspaceNameError";
  }
}

export class NotDefaultWorkspaceError extends JwError {
  constructor() {
    super("This command can only be used in the default workspace");
    this.name = "NotDefaultWorkspaceError";
  }
}

export class ConfigAlreadyExistsError extends JwError {
  constructor(path: string) {
    super(`Config file already exists: ${path}`);
    this.name = "ConfigAlreadyExistsError";
  }
}
