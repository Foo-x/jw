import { beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import type { Jujutsu } from "@/controller/ports.ts";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { existsSync } from "node:fs";
import { createJwConfigRepository } from "@/infrastructure/config-repository.ts";

const configPath = "/home/user/myrepo/.jwconfig";
const jj = { getDefaultWorkspacePath: () => "/home/user/myrepo" } as Jujutsu;
const repo = createJwConfigRepository(jj);

function mockFile(content: string) {
  globalThis.Bun = {
    ...globalThis.Bun,
    file: vi.fn().mockReturnValue({ text: vi.fn().mockResolvedValue(content) }),
  };
}

describe("path / exists", () => {
  test("path is under the default workspace", () => {
    expect(repo.path()).toBe(configPath);
  });

  test("exists checks the config path", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(repo.exists()).toBe(true);
    expect(existsSync).toHaveBeenCalledWith(configPath);
  });
});

describe("load", () => {
  const defaults = { copyFiles: [], postCreateCommands: [], workspacesDirSuffix: "__ws" };

  test("returns default config when the file does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(await repo.load()).toEqual(defaults);
  });

  test("returns parsed config for valid JSON", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const config = {
      copyFiles: [".env"],
      postCreateCommands: ["npm install"],
      workspacesDirSuffix: "-ws",
    };
    mockFile(JSON.stringify(config));

    expect(await repo.load()).toEqual(config);
    expect(globalThis.Bun.file).toHaveBeenCalledWith(configPath);
  });

  test("returns default config and logs for invalid JSON", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    mockFile("{ not valid json }");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await repo.load()).toEqual(defaults);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Failed to load config file/));
    consoleSpy.mockRestore();
  });

  test("omits workspacesDirSuffix for an empty object", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    mockFile("{}");
    expect(await repo.load()).toEqual({ copyFiles: [], postCreateCommands: [] });
  });
});

describe("save", () => {
  let writeMock: Mock;

  beforeEach(() => {
    writeMock = vi.fn().mockResolvedValue(0);
    globalThis.Bun = { ...globalThis.Bun, write: writeMock };
  });

  test("writes pretty-printed JSON to the config path", async () => {
    const config = { copyFiles: [], postCreateCommands: [], workspacesDirSuffix: "__ws" };
    await repo.save(config);
    expect(writeMock).toHaveBeenCalledWith(configPath, JSON.stringify(config, null, 2));
  });
});
