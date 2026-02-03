import { afterEach, beforeAll, beforeEach, describe, expect, mock, test, vi } from "bun:test";
import { DEFAULT_WORKSPACE_NAME } from "../constants.ts";
import {
  CannotRemoveDefaultWorkspaceError,
  JujutsuCommandError,
  WorkspaceExistsError,
  WorkspaceNotFoundError,
} from "../errors.ts";

const actualConfig = await import("../config.ts");
const actualUtils = await import("../utils.ts");

const existsSyncMock = vi.fn();
const loadConfigMock = vi.fn();
const initConfigMock = vi.fn();
const getConfigPathMock = vi.fn();
const copyFileOrDirMock = vi.fn();
const execCommandMock = vi.fn();
const getDefaultWorkspacePathMock = vi.fn();
const getJjWorkspaceListMock = vi.fn();
const getRepoRootMock = vi.fn();
const getWorkspacePathMock = vi.fn();
const getWorkspacesDirMock = vi.fn();
const normalizeWorkspaceNameMock = vi.fn();
const removeDirMock = vi.fn();

mock.module("node:fs", () => ({
  existsSync: existsSyncMock,
}));

mock.module("../config.ts", () => ({
  ...actualConfig,
  getConfigPath: getConfigPathMock,
  initConfig: initConfigMock,
  loadConfig: loadConfigMock,
}));

mock.module("../utils.ts", () => ({
  ...actualUtils,
  copyFileOrDir: copyFileOrDirMock,
  execCommand: execCommandMock,
  getDefaultWorkspacePath: getDefaultWorkspacePathMock,
  getJjWorkspaceList: getJjWorkspaceListMock,
  getRepoRoot: getRepoRootMock,
  getWorkspacePath: getWorkspacePathMock,
  getWorkspacesDir: getWorkspacesDirMock,
  normalizeWorkspaceName: normalizeWorkspaceNameMock,
  removeDir: removeDirMock,
}));

let workspace: typeof import("../workspace.ts");
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  workspace = await import("../workspace.ts");
});

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  loadConfigMock.mockResolvedValue({
    copyFiles: [],
    postCreateCommands: [],
    workspacesDirSuffix: "-workspaces",
  });
  initConfigMock.mockResolvedValue(undefined);
  getConfigPathMock.mockReturnValue("/repo/.jwconfig");
  normalizeWorkspaceNameMock.mockImplementation((name: string) => name.replace(/\//g, "-"));
  getWorkspacePathMock.mockImplementation((name: string) => `/repo-workspaces/${name}`);
  getWorkspacesDirMock.mockReturnValue("/repo-workspaces");
  getDefaultWorkspacePathMock.mockReturnValue("/repo");
  getRepoRootMock.mockReturnValue("/repo");
  getJjWorkspaceListMock.mockResolvedValue([]);
  execCommandMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  existsSyncMock.mockReturnValue(false);
  copyFileOrDirMock.mockResolvedValue(undefined);
  removeDirMock.mockResolvedValue(undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("formatDefaultWorkspaceLine", () => {
  test("marks default workspace when current path matches", () => {
    expect(workspace.formatDefaultWorkspaceLine("/repo", "/repo")).toBe("* default (/repo)");
  });

  test("uses blank mark when current path differs", () => {
    expect(workspace.formatDefaultWorkspaceLine("/repo", "/other")).toBe("  default (/repo)");
  });
});

describe("formatWorkspaceLine", () => {
  test("marks workspace when current path matches", () => {
    expect(
      workspace.formatWorkspaceLine(
        "feature",
        "/repo-workspaces/feature",
        "/repo-workspaces/feature",
        true
      )
    ).toBe("* feature (/repo-workspaces/feature)");
  });

  test("uses blank mark when current path differs", () => {
    expect(
      workspace.formatWorkspaceLine("feature", "/repo-workspaces/feature", "/repo", true)
    ).toBe("  feature (/repo-workspaces/feature)");
  });

  test("prints missing workspace marker when path does not exist", () => {
    expect(
      workspace.formatWorkspaceLine("feature", "/repo-workspaces/feature", "/repo", false)
    ).toBe("  feature ✗");
  });
});

describe("newWorkspace", () => {
  test("throws when workspace already exists", async () => {
    existsSyncMock.mockImplementation((path: string) => path === "/repo-workspaces/feature");
    await expect(workspace.newWorkspace("feature")).rejects.toBeInstanceOf(WorkspaceExistsError);
    expect(execCommandMock).not.toHaveBeenCalled();
  });

  test("creates workspace, copies files, and warns on command failure", async () => {
    loadConfigMock.mockResolvedValue({
      copyFiles: ["README.md", ".env"],
      postCreateCommands: ["npm install", "bun test"],
      workspacesDirSuffix: "-workspaces",
    });
    execCommandMock
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "boom", exitCode: 1 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await workspace.newWorkspace("feature", "abc123");

    expect(execCommandMock).toHaveBeenNthCalledWith(1, "mkdir", ["-p", "/repo-workspaces"]);
    expect(execCommandMock).toHaveBeenNthCalledWith(2, "jj", [
      "workspace",
      "add",
      "--name",
      "feature",
      "--revision",
      "abc123",
      "/repo-workspaces/feature",
    ]);
    expect(copyFileOrDirMock).toHaveBeenCalledWith("/repo/README.md", "/repo-workspaces/feature");
    expect(copyFileOrDirMock).toHaveBeenCalledWith("/repo/.env", "/repo-workspaces/feature");
    expect(execCommandMock).toHaveBeenCalledWith("npm", ["install"], "/repo-workspaces/feature");
    expect(execCommandMock).toHaveBeenCalledWith("bun", ["test"], "/repo-workspaces/feature");
    expect(warnSpy).toHaveBeenCalledWith("Command failed: npm install");
    expect(warnSpy).toHaveBeenCalledWith("boom");
  });

  test("throws when jj workspace add fails", async () => {
    existsSyncMock.mockImplementation((path: string) => path === "/repo-workspaces");
    execCommandMock.mockResolvedValueOnce({ stdout: "", stderr: "nope", exitCode: 1 });
    await expect(workspace.newWorkspace("feature")).rejects.toBeInstanceOf(JujutsuCommandError);
  });
});

describe("listWorkspaces", () => {
  test("logs workspaces with default and missing markers", async () => {
    getJjWorkspaceListMock.mockResolvedValue(["default", "feature", "stale"]);
    existsSyncMock.mockImplementation((path: string) => path === "/repo-workspaces/feature");

    await workspace.listWorkspaces();

    expect(logSpy).toHaveBeenNthCalledWith(1, "* default (/repo)");
    expect(logSpy).toHaveBeenNthCalledWith(2, "  feature (/repo-workspaces/feature)");
    expect(logSpy).toHaveBeenNthCalledWith(3, "  stale ✗");
  });
});

describe("goWorkspace", () => {
  test("prints default workspace path", async () => {
    await workspace.goWorkspace(DEFAULT_WORKSPACE_NAME);
    expect(logSpy).toHaveBeenCalledWith("/repo");
    expect(getWorkspacePathMock).not.toHaveBeenCalled();
  });

  test("throws when workspace is missing", async () => {
    await expect(workspace.goWorkspace("feature")).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });

  test("prints workspace path when it exists", async () => {
    existsSyncMock.mockImplementation((path: string) => path === "/repo-workspaces/feature");
    await workspace.goWorkspace("feature");
    expect(logSpy).toHaveBeenCalledWith("/repo-workspaces/feature");
  });
});

describe("removeWorkspace", () => {
  test("throws when removing default workspace", async () => {
    await expect(workspace.removeWorkspace(DEFAULT_WORKSPACE_NAME)).rejects.toBeInstanceOf(
      CannotRemoveDefaultWorkspaceError
    );
  });

  test("forgets and removes workspace, warning on jj failure", async () => {
    existsSyncMock.mockImplementation((path: string) => path === "/repo-workspaces/feature");
    execCommandMock.mockResolvedValueOnce({ stdout: "", stderr: "boom", exitCode: 1 });

    await workspace.removeWorkspace("feature");

    expect(execCommandMock).toHaveBeenCalledWith("jj", ["workspace", "forget", "feature"]);
    expect(warnSpy).toHaveBeenCalledWith("Failed to run jj workspace forget: boom");
    expect(removeDirMock).toHaveBeenCalledWith("/repo-workspaces/feature");
    expect(logSpy).toHaveBeenCalledWith('Removed workspace "feature"');
  });
});

describe("copyToWorkspace", () => {
  test("throws when workspace is missing", async () => {
    await expect(workspace.copyToWorkspace("feature")).rejects.toBeInstanceOf(
      WorkspaceNotFoundError
    );
  });

  test("copies files to workspace", async () => {
    loadConfigMock.mockResolvedValue({
      copyFiles: ["README.md"],
      postCreateCommands: [],
      workspacesDirSuffix: "-workspaces",
    });
    existsSyncMock.mockImplementation((path: string) => path === "/repo-workspaces/feature");

    await workspace.copyToWorkspace("feature");

    expect(copyFileOrDirMock).toHaveBeenCalledWith("/repo/README.md", "/repo-workspaces/feature");
  });
});

describe("renameWorkspace", () => {
  test("throws when old workspace is missing", async () => {
    await expect(workspace.renameWorkspace("old", "new")).rejects.toBeInstanceOf(
      WorkspaceNotFoundError
    );
  });

  test("throws when new workspace already exists", async () => {
    existsSyncMock.mockImplementation(
      (path: string) => path === "/repo-workspaces/old" || path === "/repo-workspaces/new"
    );
    await expect(workspace.renameWorkspace("old", "new")).rejects.toBeInstanceOf(
      WorkspaceExistsError
    );
  });

  test("throws when jj rename fails", async () => {
    existsSyncMock.mockImplementation((path: string) => path === "/repo-workspaces/old");
    execCommandMock.mockResolvedValueOnce({ stdout: "", stderr: "rename failed", exitCode: 1 });

    await expect(workspace.renameWorkspace("old", "new")).rejects.toBeInstanceOf(
      JujutsuCommandError
    );
  });

  test("renames workspace when jj succeeds", async () => {
    existsSyncMock.mockImplementation((path: string) => path === "/repo-workspaces/old");
    execCommandMock
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await workspace.renameWorkspace("old", "new");

    expect(execCommandMock).toHaveBeenNthCalledWith(
      1,
      "jj",
      ["workspace", "rename", "new"],
      "/repo-workspaces/old"
    );
    expect(execCommandMock).toHaveBeenNthCalledWith(2, "mv", [
      "/repo-workspaces/old",
      "/repo-workspaces/new",
    ]);
    expect(logSpy).toHaveBeenCalledWith('Renamed workspace "old" to "new"');
  });
});

describe("cleanWorkspaces", () => {
  test("logs when no stale workspaces are found", async () => {
    getJjWorkspaceListMock.mockResolvedValue(["default", "feature"]);
    existsSyncMock.mockImplementation((path: string) => path === "/repo-workspaces/feature");

    await workspace.cleanWorkspaces();

    expect(logSpy).toHaveBeenCalledWith("No stale workspaces found");
    expect(execCommandMock).not.toHaveBeenCalled();
  });

  test("forgets missing workspaces and logs warnings", async () => {
    getJjWorkspaceListMock.mockResolvedValue(["default", "gone", "fail"]);
    execCommandMock
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "boom\n", exitCode: 1 });

    await workspace.cleanWorkspaces();

    expect(logSpy).toHaveBeenCalledWith("Forgotten workspaces:");
    expect(logSpy).toHaveBeenCalledWith("  gone");
    expect(warnSpy).toHaveBeenCalledWith('Failed to forget workspace "fail": boom');
  });
});

describe("initWorkspace", () => {
  test("initializes config and logs path", async () => {
    await workspace.initWorkspace();
    expect(getRepoRootMock).toHaveBeenCalled();
    expect(initConfigMock).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Initialized jw config: /repo/.jwconfig");
  });
});
