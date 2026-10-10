import { InvalidWorkspacesDirSuffixError } from "./errors.ts";
import { WORKSPACES_DIR_SUFFIX } from "./workspace.ts";

export interface Config {
  copyFiles: string[];
  postCreateCommands: string[];
  workspacesDirSuffix?: string;
}

export function getDefaultConfig(): Config {
  return {
    copyFiles: [],
    postCreateCommands: [],
    workspacesDirSuffix: WORKSPACES_DIR_SUFFIX,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function parseConfig(data: unknown): Config {
  const defaults = getDefaultConfig();

  if (typeof data !== "object" || data === null) {
    return defaults;
  }

  const obj = data as Record<string, unknown>;

  const workspacesDirSuffix =
    typeof obj.workspacesDirSuffix === "string" && obj.workspacesDirSuffix !== ""
      ? obj.workspacesDirSuffix
      : undefined;

  // A path separator would move the workspaces directory outside the sibling layout
  if (workspacesDirSuffix !== undefined && /[/\\]/.test(workspacesDirSuffix)) {
    throw new InvalidWorkspacesDirSuffixError(workspacesDirSuffix);
  }

  return {
    copyFiles: isStringArray(obj.copyFiles) ? obj.copyFiles : defaults.copyFiles,
    postCreateCommands: isStringArray(obj.postCreateCommands)
      ? obj.postCreateCommands
      : defaults.postCreateCommands,
    ...(workspacesDirSuffix !== undefined && { workspacesDirSuffix }),
  };
}
