import { existsSync } from "node:fs";
import { beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import { getConfigPath, initConfig, loadConfig, parseConfig, saveConfig } from "../config.ts";
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

describe("parseConfig", () => {
  test("returns default config when data is null", () => {
    const result = parseConfig(null);
    expect(result).toEqual({
      copyFiles: [],
      postCreateCommands: [],
      workspacesDirSuffix: "-workspaces",
    });
  });

  test("returns default config when data is not an object", () => {
    const result = parseConfig("invalid");
    expect(result).toEqual({
      copyFiles: [],
      postCreateCommands: [],
      workspacesDirSuffix: "-workspaces",
    });
  });

  test("parses valid config correctly", () => {
    const input = {
      copyFiles: [".env", "config.json"],
      postCreateCommands: ["npm install"],
    };
    const result = parseConfig(input);
    expect(result).toEqual(input);
  });

  test("ignores legacy workspaces field", () => {
    const input = {
      workspaces: ["workspace1", "workspace2"],
      copyFiles: [".env"],
      postCreateCommands: [],
    };
    const result = parseConfig(input);
    expect(result).toEqual({
      copyFiles: [".env"],
      postCreateCommands: [],
    });
  });

  test("handles missing fields", () => {
    const input = {
      copyFiles: [".env"],
    };
    const result = parseConfig(input);
    expect(result.copyFiles).toEqual([".env"]);
    expect(result.postCreateCommands).toEqual([]);
  });

  test("handles empty object", () => {
    const result = parseConfig({});
    expect(result).toEqual({
      copyFiles: [],
      postCreateCommands: [],
    });
  });

  test("defaults copyFiles when not string array", () => {
    const result = parseConfig({ copyFiles: ["ok", 123] });
    expect(result.copyFiles).toEqual([]);
  });

  test("defaults postCreateCommands when not string array", () => {
    const result = parseConfig({ postCreateCommands: ["ok", null] });
    expect(result.postCreateCommands).toEqual([]);
  });
});

describe("parseConfig - workspacesDirSuffix", () => {
  test("parses valid workspacesDirSuffix string", () => {
    const result = parseConfig({ workspacesDirSuffix: "-ws" });
    expect(result.workspacesDirSuffix).toBe("-ws");
  });

  test("parses another valid workspacesDirSuffix string", () => {
    const result = parseConfig({ workspacesDirSuffix: "_workspaces" });
    expect(result.workspacesDirSuffix).toBe("_workspaces");
  });

  test("returns undefined workspacesDirSuffix when not set", () => {
    const result = parseConfig({});
    expect(result.workspacesDirSuffix).toBeUndefined();
  });

  test("returns undefined workspacesDirSuffix when null", () => {
    const result = parseConfig({ workspacesDirSuffix: null });
    expect(result.workspacesDirSuffix).toBeUndefined();
  });

  test("returns undefined workspacesDirSuffix when number", () => {
    const result = parseConfig({ workspacesDirSuffix: 123 });
    expect(result.workspacesDirSuffix).toBeUndefined();
  });

  test("returns undefined workspacesDirSuffix when array", () => {
    const result = parseConfig({ workspacesDirSuffix: ["a"] });
    expect(result.workspacesDirSuffix).toBeUndefined();
  });

  test("returns undefined workspacesDirSuffix when empty string", () => {
    const result = parseConfig({ workspacesDirSuffix: "" });
    expect(result.workspacesDirSuffix).toBeUndefined();
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
      workspacesDirSuffix: "-workspaces",
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
      workspacesDirSuffix: "-workspaces",
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

describe("saveConfig", () => {
  const configPath = "/home/user/myrepo/.jwconfig";
  let writeMock: Mock;

  beforeEach(() => {
    vi.mocked(getDefaultWorkspacePath).mockReturnValue("/home/user/myrepo");
    writeMock = vi.mocked(vi.fn().mockResolvedValue(0));
    globalThis.Bun = {
      ...globalThis.Bun,
      write: writeMock,
    };
  });

  test("writes config to the correct path", async () => {
    const config = { copyFiles: [], postCreateCommands: [] };
    await saveConfig(config);
    expect(writeMock).toHaveBeenCalledWith(configPath, expect.any(String));
  });

  test("writes config as pretty-printed JSON", async () => {
    const config = {
      copyFiles: [".env"],
      postCreateCommands: ["npm install"],
      workspacesDirSuffix: "-ws",
    };
    await saveConfig(config);
    expect(writeMock).toHaveBeenCalledWith(configPath, JSON.stringify(config, null, 2));
  });

  test("writes minimal config with no optional fields", async () => {
    const config = { copyFiles: [], postCreateCommands: [] };
    await saveConfig(config);
    expect(writeMock).toHaveBeenCalledWith(configPath, JSON.stringify(config, null, 2));
  });

  test("throws and logs error when Bun.write fails", async () => {
    const writeError = new Error("disk full");
    writeMock.mockRejectedValue(writeError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(saveConfig({ copyFiles: [], postCreateCommands: [] })).rejects.toThrow(writeError);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Failed to save config file/));
    consoleSpy.mockRestore();
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
          workspacesDirSuffix: "-workspaces",
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
