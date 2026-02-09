import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_WORKSPACE_NAME } from "../constants.ts";
import {
  CannotRemoveDefaultWorkspaceError,
  JujutsuCommandError,
  NotDefaultWorkspaceError,
  ValidationError,
  WorkspaceExistsError,
  WorkspaceNotFoundError,
} from "../errors.ts";

const mockExistsSync = vi.fn();
const mockLoadConfig = vi.fn();
const mockInitConfig = vi.fn();
const mockGetConfigPath = vi.fn();
const mockCopyFileOrDir = vi.fn();
const mockExecCommand = vi.fn();
const mockGetDefaultWorkspacePath = vi.fn();
const mockGetJjWorkspaceList = vi.fn();
const mockGetRepoRoot = vi.fn();
const mockGetWorkspacePath = vi.fn();
const mockGetWorkspacesDir = vi.fn();
const mockRemoveDir = vi.fn();
const mockGetCurrentWorkspaceName = vi.fn();
const mockGetChangeIdFromWorkspaceList = vi.fn();
const mockGetJjWorkspaceChangeId = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
}));

vi.mock(import("../config.ts"), async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getConfigPath: mockGetConfigPath,
    initConfig: mockInitConfig,
    loadConfig: mockLoadConfig,
  };
});

vi.mock(import("../utils.ts"), async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    copyFileOrDir: mockCopyFileOrDir,
    execCommand: mockExecCommand,
    getDefaultWorkspacePath: mockGetDefaultWorkspacePath,
    getJjWorkspaceList: mockGetJjWorkspaceList,
    getRepoRoot: mockGetRepoRoot,
    getWorkspacePath: mockGetWorkspacePath,
    getWorkspacesDir: mockGetWorkspacesDir,
    removeDir: mockRemoveDir,
    getCurrentWorkspaceName: mockGetCurrentWorkspaceName,
    getChangeIdFromWorkspaceList: mockGetChangeIdFromWorkspaceList,
    getJjWorkspaceChangeId: mockGetJjWorkspaceChangeId,
  };
});

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
  mockLoadConfig.mockResolvedValue({
    copyFiles: [],
    postCreateCommands: [],
    workspacesDirSuffix: "__ws",
  });
  mockInitConfig.mockResolvedValue(undefined);
  mockGetConfigPath.mockReturnValue("/repo/.jwconfig");
  mockGetWorkspacePath.mockImplementation((name: string) => `/repo__ws/${name}`);
  mockGetWorkspacesDir.mockReturnValue("/repo__ws");
  mockGetDefaultWorkspacePath.mockReturnValue("/repo");
  mockGetRepoRoot.mockReturnValue("/repo");
  mockGetJjWorkspaceList.mockResolvedValue([]);
  mockExecCommand.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockExistsSync.mockReturnValue(false);
  mockCopyFileOrDir.mockResolvedValue(undefined);
  mockRemoveDir.mockResolvedValue(undefined);
  mockGetCurrentWorkspaceName.mockReturnValue("feature-x");
  mockGetChangeIdFromWorkspaceList.mockReturnValue(null);
  mockGetJjWorkspaceChangeId.mockResolvedValue("abc123");
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
      workspace.formatWorkspaceLine("feature", "/repo__ws/feature", "/repo__ws/feature", true)
    ).toBe("* feature (/repo__ws/feature)");
  });

  test("uses blank mark when current path differs", () => {
    expect(workspace.formatWorkspaceLine("feature", "/repo__ws/feature", "/repo", true)).toBe(
      "  feature (/repo__ws/feature)"
    );
  });

  test("prints missing workspace marker when path does not exist", () => {
    expect(workspace.formatWorkspaceLine("feature", "/repo__ws/feature", "/repo", false)).toBe(
      "  feature ✗"
    );
  });
});

describe("newWorkspace", () => {
  test("throws when workspace already exists", async () => {
    mockExistsSync.mockImplementation((path: string) => path === "/repo__ws/feature");
    await expect(workspace.newWorkspace("feature")).rejects.toBeInstanceOf(WorkspaceExistsError);
    expect(mockExecCommand).not.toHaveBeenCalled();
  });

  test("creates workspace with revision", async () => {
    await workspace.newWorkspace("feature", "abc123");

    expect(mockExecCommand).toHaveBeenNthCalledWith(1, "mkdir", ["-p", "/repo__ws"]);
    expect(mockExecCommand).toHaveBeenNthCalledWith(2, "jj", [
      "workspace",
      "add",
      "--name",
      "feature",
      "--revision",
      "abc123",
      "/repo__ws/feature",
    ]);
  });

  test("copies configured files to new workspace", async () => {
    mockLoadConfig.mockResolvedValue({
      copyFiles: ["README.md", ".env"],
      postCreateCommands: [],
      workspacesDirSuffix: "__ws",
    });

    await workspace.newWorkspace("feature");

    expect(mockCopyFileOrDir).toHaveBeenCalledWith("/repo/README.md", "/repo__ws/feature");
    expect(mockCopyFileOrDir).toHaveBeenCalledWith("/repo/.env", "/repo__ws/feature");
  });

  test("warns when post-create command fails", async () => {
    mockLoadConfig.mockResolvedValue({
      copyFiles: [],
      postCreateCommands: ["npm install", "bun test"],
      workspacesDirSuffix: "__ws",
    });
    mockExecCommand
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "boom", exitCode: 1 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await workspace.newWorkspace("feature");

    expect(mockExecCommand).toHaveBeenCalledWith("npm", ["install"], "/repo__ws/feature");
    expect(mockExecCommand).toHaveBeenCalledWith("bun", ["test"], "/repo__ws/feature");
    expect(warnSpy).toHaveBeenCalledWith("Command failed: npm install");
    expect(warnSpy).toHaveBeenCalledWith("boom");
  });

  test("throws when jj workspace add fails", async () => {
    mockExistsSync.mockImplementation((path: string) => path === "/repo__ws");
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "nope",
      exitCode: 1,
    });
    await expect(workspace.newWorkspace("feature")).rejects.toBeInstanceOf(JujutsuCommandError);
  });
});

describe("listWorkspaces", () => {
  test("logs workspaces with default and missing markers", async () => {
    mockGetJjWorkspaceList.mockResolvedValue(["default", "feature", "stale"]);
    mockExistsSync.mockImplementation((path: string) => path === "/repo__ws/feature");

    await workspace.listWorkspaces();

    expect(logSpy).toHaveBeenNthCalledWith(1, "* default (/repo)");
    expect(logSpy).toHaveBeenNthCalledWith(2, "  feature (/repo__ws/feature)");
    expect(logSpy).toHaveBeenNthCalledWith(3, "  stale ✗");
  });
});

describe("goWorkspace", () => {
  test("prints default workspace path", async () => {
    await workspace.goWorkspace(DEFAULT_WORKSPACE_NAME);
    expect(logSpy).toHaveBeenCalledWith("/repo");
    expect(mockGetWorkspacePath).not.toHaveBeenCalled();
  });

  test("throws when workspace is missing", async () => {
    await expect(workspace.goWorkspace("feature")).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });

  test("prints workspace path when it exists", async () => {
    mockExistsSync.mockImplementation((path: string) => path === "/repo__ws/feature");
    await workspace.goWorkspace("feature");
    expect(logSpy).toHaveBeenCalledWith("/repo__ws/feature");
  });
});

describe("removeWorkspace", () => {
  test("throws when removing default workspace", async () => {
    await expect(workspace.removeWorkspace(DEFAULT_WORKSPACE_NAME)).rejects.toBeInstanceOf(
      CannotRemoveDefaultWorkspaceError
    );
  });

  test("forgets and removes workspace, warning on jj failure", async () => {
    mockExistsSync.mockImplementation((path: string) => path === "/repo__ws/feature");
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "boom",
      exitCode: 1,
    });

    await workspace.removeWorkspace("feature");

    expect(mockExecCommand).toHaveBeenCalledWith("jj", ["workspace", "forget", "feature"]);
    expect(warnSpy).toHaveBeenCalledWith("Failed to run jj workspace forget: boom");
    expect(mockRemoveDir).toHaveBeenCalledWith("/repo__ws/feature");
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
    mockLoadConfig.mockResolvedValue({
      copyFiles: ["README.md"],
      postCreateCommands: [],
      workspacesDirSuffix: "__ws",
    });
    mockExistsSync.mockImplementation((path: string) => path === "/repo__ws/feature");

    await workspace.copyToWorkspace("feature");

    expect(mockCopyFileOrDir).toHaveBeenCalledWith("/repo/README.md", "/repo__ws/feature");
  });
});

describe("renameWorkspace", () => {
  test("throws when old workspace is missing", async () => {
    await expect(workspace.renameWorkspace("old", "new")).rejects.toBeInstanceOf(
      WorkspaceNotFoundError
    );
  });

  test("throws when new workspace already exists", async () => {
    mockExistsSync.mockImplementation(
      (path: string) => path === "/repo__ws/old" || path === "/repo__ws/new"
    );
    await expect(workspace.renameWorkspace("old", "new")).rejects.toBeInstanceOf(
      WorkspaceExistsError
    );
  });

  test("throws when jj rename fails", async () => {
    mockExistsSync.mockImplementation((path: string) => path === "/repo__ws/old");
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "rename failed",
      exitCode: 1,
    });

    await expect(workspace.renameWorkspace("old", "new")).rejects.toBeInstanceOf(
      JujutsuCommandError
    );
  });

  test("renames workspace when jj succeeds", async () => {
    mockExistsSync.mockImplementation((path: string) => path === "/repo__ws/old");
    mockExecCommand
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await workspace.renameWorkspace("old", "new");

    expect(mockExecCommand).toHaveBeenNthCalledWith(
      1,
      "jj",
      ["workspace", "rename", "new"],
      "/repo__ws/old"
    );
    expect(mockExecCommand).toHaveBeenNthCalledWith(2, "mv", ["/repo__ws/old", "/repo__ws/new"]);
    expect(logSpy).toHaveBeenCalledWith('Renamed workspace "old" to "new"');
  });
});

describe("cleanWorkspaces", () => {
  test("logs when no stale workspaces are found", async () => {
    mockGetJjWorkspaceList.mockResolvedValue(["default", "feature"]);
    mockExistsSync.mockImplementation((path: string) => path === "/repo__ws/feature");

    await workspace.cleanWorkspaces();

    expect(logSpy).toHaveBeenCalledWith("No stale workspaces found");
    expect(mockExecCommand).not.toHaveBeenCalled();
  });

  test("forgets missing workspaces and logs warnings", async () => {
    mockGetJjWorkspaceList.mockResolvedValue(["default", "gone", "fail"]);
    mockExecCommand
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
    expect(mockGetRepoRoot).toHaveBeenCalled();
    expect(mockInitConfig).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Initialized jw config: /repo/.jwconfig");
  });
});

describe("thisWorkspace", () => {
  test("throws ValidationError when in default workspace", async () => {
    mockGetCurrentWorkspaceName.mockReturnValue("default");

    await expect(workspace.thisWorkspace()).rejects.toBeInstanceOf(ValidationError);
    await expect(workspace.thisWorkspace()).rejects.toThrow(
      "Cannot run 'jw this' from default workspace"
    );
  });

  test("executes jj edit with current change_id in default workspace directory", async () => {
    mockGetCurrentWorkspaceName.mockReturnValue("feature-x");
    mockExecCommand.mockResolvedValueOnce({
      stdout: "feature-x: def789 commit000\n",
      stderr: "",
      exitCode: 0,
    });
    mockGetChangeIdFromWorkspaceList.mockReturnValue("def789");
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    await workspace.thisWorkspace();

    expect(mockExecCommand).toHaveBeenNthCalledWith(1, "jj", ["workspace", "list"]);
    expect(mockGetChangeIdFromWorkspaceList).toHaveBeenCalledWith(
      "feature-x: def789 commit000\n",
      "feature-x"
    );
    expect(mockExecCommand).toHaveBeenNthCalledWith(2, "jj", ["edit", "def789"], "/repo");
  });

  test("displays success message after jj edit succeeds", async () => {
    mockGetCurrentWorkspaceName.mockReturnValue("feature-x");
    mockExecCommand.mockResolvedValueOnce({
      stdout: "feature-x: def789 commit000\n",
      stderr: "",
      exitCode: 0,
    });
    mockGetChangeIdFromWorkspaceList.mockReturnValue("def789");
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    await workspace.thisWorkspace();

    expect(logSpy).toHaveBeenCalledWith('Switched default workspace to "feature-x" (def789)');
  });

  test("throws JujutsuCommandError when jj workspace list fails", async () => {
    mockGetCurrentWorkspaceName.mockReturnValue("feature-x");
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "fatal: not a jj repo\n",
      exitCode: 1,
    });

    await expect(workspace.thisWorkspace()).rejects.toBeInstanceOf(JujutsuCommandError);
  });

  test("throws ValidationError when current workspace not found in list", async () => {
    mockGetCurrentWorkspaceName.mockReturnValue("feature-x");
    mockExecCommand.mockResolvedValue({
      stdout: "default: abc123 commit456\n",
      stderr: "",
      exitCode: 0,
    });
    mockGetChangeIdFromWorkspaceList.mockReturnValue(null);

    await expect(workspace.thisWorkspace()).rejects.toBeInstanceOf(ValidationError);
    await expect(workspace.thisWorkspace()).rejects.toThrow(
      'Current workspace "feature-x" not found in jj workspace list'
    );
  });

  test("throws JujutsuCommandError when jj edit fails", async () => {
    mockGetCurrentWorkspaceName.mockReturnValue("feature-x");
    mockGetChangeIdFromWorkspaceList.mockReturnValue("def789");
    mockExecCommand
      .mockResolvedValueOnce({
        stdout: "feature-x: def789 commit000\n",
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "error: no such revision\n",
        exitCode: 1,
      });

    const error = await workspace.thisWorkspace().catch((e) => e);
    expect(error).toBeInstanceOf(JujutsuCommandError);
    expect(error.message).toContain("no such revision");
  });
});

describe("useWorkspace", () => {
  test("throws ValidationError when name is undefined", async () => {
    await expect(workspace.useWorkspace(undefined as unknown as string)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  test("throws ValidationError when name is default", async () => {
    await expect(workspace.useWorkspace("default")).rejects.toBeInstanceOf(ValidationError);
    await expect(workspace.useWorkspace("default")).rejects.toThrow(
      "Cannot use the default workspace"
    );
  });

  test("throws NotDefaultWorkspaceError when not in default workspace", async () => {
    mockGetRepoRoot.mockReturnValue("/repo__ws/feature");

    await expect(workspace.useWorkspace("feature-x")).rejects.toBeInstanceOf(
      NotDefaultWorkspaceError
    );
  });

  test("executes jj edit with correct change_id in default workspace", async () => {
    mockGetJjWorkspaceChangeId.mockResolvedValue("def789");

    await workspace.useWorkspace("feature-x");

    expect(mockGetJjWorkspaceChangeId).toHaveBeenCalledWith("feature-x");
    expect(mockExecCommand).toHaveBeenCalledWith("jj", ["edit", "def789"], "/repo");
  });

  test("displays success message after jj edit succeeds", async () => {
    mockGetJjWorkspaceChangeId.mockResolvedValue("def789");

    await workspace.useWorkspace("feature-x");

    expect(logSpy).toHaveBeenCalledWith('Switched default workspace to "feature-x" (def789)');
  });

  test("throws WorkspaceNotFoundError when workspace does not exist", async () => {
    mockGetJjWorkspaceChangeId.mockRejectedValue(new WorkspaceNotFoundError("nonexistent"));

    await expect(workspace.useWorkspace("nonexistent")).rejects.toBeInstanceOf(
      WorkspaceNotFoundError
    );
  });

  test("throws JujutsuCommandError when jj edit fails", async () => {
    mockGetJjWorkspaceChangeId.mockResolvedValue("def789");
    mockExecCommand.mockResolvedValue({
      stdout: "",
      stderr: "error: no such revision\n",
      exitCode: 1,
    });

    await expect(workspace.useWorkspace("feature-x")).rejects.toBeInstanceOf(JujutsuCommandError);
  });
});
