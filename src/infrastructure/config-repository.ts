import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ConfigRepository, Jujutsu } from "../controller/ports.ts";
import { type Config, getDefaultConfig, parseConfig } from "../domain/config.ts";
import { CONFIG_FILE_NAME } from "./constants.ts";

export function createJwConfigRepository(jj: Jujutsu): ConfigRepository {
  const path = () => join(jj.getDefaultWorkspacePath(), CONFIG_FILE_NAME);

  return {
    path,
    exists: () => existsSync(path()),

    async load(): Promise<Config> {
      const configPath = path();

      if (!existsSync(configPath)) {
        return getDefaultConfig();
      }

      let data: unknown;
      try {
        data = JSON.parse(await Bun.file(configPath).text());
      } catch (error) {
        console.error(`Failed to load config file: ${error}`);
        return getDefaultConfig();
      }

      return parseConfig(data);
    },

    async save(config) {
      await Bun.write(path(), JSON.stringify(config, null, 2));
    },
  };
}
