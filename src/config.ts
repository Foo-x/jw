import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE_NAME, WORKSPACES_DIR_SUFFIX } from "./constants.ts";
import { ConfigAlreadyExistsError } from "./errors.ts";
import { getDefaultWorkspacePath } from "./utils.ts";

export interface Config {
  copyFiles: string[];
  postCreateCommands: string[];
  workspacesDirSuffix?: string;
}

export function getConfigPath(): string {
  return join(getDefaultWorkspacePath(), CONFIG_FILE_NAME);
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

  return {
    copyFiles: isStringArray(obj.copyFiles) ? obj.copyFiles : defaults.copyFiles,
    postCreateCommands: isStringArray(obj.postCreateCommands)
      ? obj.postCreateCommands
      : defaults.postCreateCommands,
    ...(workspacesDirSuffix !== undefined && { workspacesDirSuffix }),
  };
}

export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return getDefaultConfig();
  }

  try {
    const file = Bun.file(configPath);
    const content = await file.text();
    const data = JSON.parse(content);

    return parseConfig(data);
  } catch (error) {
    console.error(`Failed to load config file: ${error}`);
    return getDefaultConfig();
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const configPath = getConfigPath();

  try {
    await Bun.write(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(`Failed to save config file: ${error}`);
    throw error;
  }
}

export async function initConfig(): Promise<void> {
  const configPath = getConfigPath();

  if (existsSync(configPath)) {
    throw new ConfigAlreadyExistsError(configPath);
  }

  const defaultConfig = getDefaultConfig();
  await Bun.write(configPath, JSON.stringify(defaultConfig, null, 2));
}
