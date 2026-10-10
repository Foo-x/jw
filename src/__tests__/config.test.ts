import { existsSync } from "node:fs";
import { beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import { getConfigPath, initConfig, loadConfig } from "../config.ts";
import { ConfigAlreadyExistsError } from "../errors.ts";
import { getDefaultWorkspacePath } from "../utils.ts";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("../utils.ts", () => ({
  getDefaultWorkspacePath: vi.fn(),
}));

describe("getConfigPath", () => {
  test("returns config file path under default workspace", () => {
    vi.mocked(getDefaultWorkspacePath).mockReturnValue("/home/user/myrepo");
    expect(getConfigPath()).toBe("/home/user/myrepo/.jwconfig");
  });
});

describe("loadConfig", () => {
  const configPath = "/home/user/myrepo/.jwconfig";

  function mockFile(content: string) {
    globalThis.Bun = {
      ...globalThis.Bun,
      file: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue(content),
      }),
    };
  }

  beforeEach(() => {
    vi.mocked(getDefaultWorkspacePath).mockReturnValue("/home/user/myrepo");
  });

  test("returns default config when config file does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await loadConfig();
    expect(result).toEqual({
      copyFiles: [],
      postCreateCommands: [],
      workspacesDirSuffix: "__ws",
    });
  });

  test("returns parsed config when config file exists with valid JSON", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    mockFile(
      JSON.stringify({
        copyFiles: [".env"],
        postCreateCommands: ["npm install"],
        workspacesDirSuffix: "-ws",
      })
    );

    const result = await loadConfig();
    expect(result).toEqual({
      copyFiles: [".env"],
      postCreateCommands: ["npm install"],
      workspacesDirSuffix: "-ws",
    });
  });

  test("returns default config when config file contains invalid JSON", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    mockFile("{ not valid json }");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await loadConfig();

    expect(result).toEqual({
      copyFiles: [],
      postCreateCommands: [],
      workspacesDirSuffix: "__ws",
    });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Failed to load config file/));
    consoleSpy.mockRestore();
  });

  test("returns default config when config file contains empty object", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    mockFile("{}");

    const result = await loadConfig();
    expect(result).toEqual({
      copyFiles: [],
      postCreateCommands: [],
    });
  });

  test("reads from the correct config path", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    mockFile("{}");

    await loadConfig();
    expect(existsSync).toHaveBeenCalledWith(configPath);
    expect(globalThis.Bun.file).toHaveBeenCalledWith(configPath);
  });
});

describe("initConfig", () => {
  const configPath = "/home/user/myrepo/.jwconfig";
  let writeMock: Mock;

  beforeEach(() => {
    vi.mocked(getDefaultWorkspacePath).mockReturnValue("/home/user/myrepo");
    writeMock = vi.fn().mockResolvedValue(0);
    globalThis.Bun = {
      ...globalThis.Bun,
      write: writeMock,
    };
  });

  test("writes default config when config file does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await initConfig();

    expect(writeMock).toHaveBeenCalledWith(
      configPath,
      JSON.stringify(
        {
          copyFiles: [],
          postCreateCommands: [],
          workspacesDirSuffix: "__ws",
        },
        null,
        2
      )
    );
  });

  test("writes to the correct config path", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await initConfig();

    expect(existsSync).toHaveBeenCalledWith(configPath);
    expect(writeMock).toHaveBeenCalledWith(configPath, expect.any(String));
  });

  test("throws ConfigAlreadyExistsError when config file already exists", async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    await expect(initConfig()).rejects.toThrow(ConfigAlreadyExistsError);
    expect(writeMock).not.toHaveBeenCalled();
  });

  test("throws error with config path in message when config already exists", async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    await expect(initConfig()).rejects.toThrow(
      expect.objectContaining({ message: expect.stringContaining(configPath) })
    );
  });
});
