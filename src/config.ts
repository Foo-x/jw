import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE_NAME } from "./constants.ts";
import { getDefaultWorkspacePath } from "./utils.ts";

export interface Config {
  workspaces: string[];
  copyFiles: string[];
  postCreateCommands: string[];
}

function getConfigPath(): string {
  return join(getDefaultWorkspacePath(), CONFIG_FILE_NAME);
}

export function getDefaultConfig(): Config {
  return {
    workspaces: [],
    copyFiles: [],
    postCreateCommands: [],
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

  return {
    workspaces: isStringArray(obj.workspaces) ? obj.workspaces : defaults.workspaces,
    copyFiles: isStringArray(obj.copyFiles) ? obj.copyFiles : defaults.copyFiles,
    postCreateCommands: isStringArray(obj.postCreateCommands)
      ? obj.postCreateCommands
      : defaults.postCreateCommands,
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

export async function addWorkspace(name: string): Promise<void> {
  const config = await loadConfig();

  if (!config.workspaces.includes(name)) {
    config.workspaces.push(name);
    await saveConfig(config);
  }
}

export async function removeWorkspace(name: string): Promise<void> {
  const config = await loadConfig();

  config.workspaces = config.workspaces.filter((w) => w !== name);
  await saveConfig(config);
}
