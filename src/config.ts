import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE_NAME } from "./constants.ts";
import { type Config, getDefaultConfig, parseConfig } from "./domain/config.ts";
import { ConfigAlreadyExistsError } from "./errors.ts";
import { getDefaultWorkspacePath } from "./utils.ts";

export function getConfigPath(): string {
  return join(getDefaultWorkspacePath(), CONFIG_FILE_NAME);
}

export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return getDefaultConfig();
  }

  let data: unknown;
  try {
    const file = Bun.file(configPath);
    const content = await file.text();
    data = JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load config file: ${error}`);
    return getDefaultConfig();
  }

  return parseConfig(data);
}

export async function initConfig(): Promise<void> {
  const configPath = getConfigPath();

  if (existsSync(configPath)) {
    throw new ConfigAlreadyExistsError(configPath);
  }

  const defaultConfig = getDefaultConfig();
  await Bun.write(configPath, JSON.stringify(defaultConfig, null, 2));
}
