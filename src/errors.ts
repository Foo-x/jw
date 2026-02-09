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

export class JujutsuCommandError extends JwError {
  constructor(operation: string, stderr: string) {
    super(`Failed to ${operation}: ${stderr}`);
    this.name = "JujutsuCommandError";
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

export class NotJujutsuRepositoryError extends JwError {
  constructor() {
    super("Not a jujutsu repository (or any of the parent directories)");
    this.name = "NotJujutsuRepositoryError";
  }
}

export class ConfigAlreadyExistsError extends JwError {
  constructor(path: string) {
    super(`Config file already exists: ${path}`);
    this.name = "ConfigAlreadyExistsError";
  }
}

export class NotDefaultWorkspaceError extends JwError {
  constructor() {
    super("This command can only be used in the default workspace");
    this.name = "NotDefaultWorkspaceError";
  }
}
