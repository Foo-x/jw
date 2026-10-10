import { JwError } from "./domain/errors.ts";

export class JujutsuCommandError extends JwError {
  constructor(operation: string, stderr: string) {
    super(`Failed to ${operation}: ${stderr}`);
    this.name = "JujutsuCommandError";
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
