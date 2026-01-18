import { existsSync } from "fs";
import { join } from "path";
import { getDefaultWorkspacePath } from "./utils.ts";

export interface Config {
  workspaces: string[];
  copyFiles: string[];
  postCreateCommands: string[];
}

const CONFIG_FILE_NAME = ".jwconfig";

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

export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return getDefaultConfig();
  }

  try {
    const file = Bun.file(configPath);
    const content = await file.text();
    const config = JSON.parse(content) as Config;

    return {
      workspaces: config.workspaces || [],
      copyFiles: config.copyFiles || [],
      postCreateCommands: config.postCreateCommands || [],
    };
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

  config.workspaces = config.workspaces.filter(w => w !== name);
  await saveConfig(config);
}
