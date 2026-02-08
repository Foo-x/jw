import { beforeEach, describe, expect, test, vi } from "vitest";
import { JujutsuCommandError, NotJujutsuRepositoryError } from "../errors.ts";
import {
  copyFileOrDir,
  execCommand,
  getChangeIdFromWorkspaceList,
  getCurrentWorkspaceName,
  getJjWorkspaceList,
  getRepoRoot,
  getWorkspacePath,
  getWorkspacesDir,
  getWorkspacesDirName,
  normalizeWorkspaceName,
  parseJjWorkspaceList,
  removeDir,
} from "../utils.ts";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}));

import { existsSync, readFileSync, statSync } from "node:fs";

// Shared test constants
const REPO_ROOT = "/home/user/my-repo";
const JJ_DIR = `${REPO_ROOT}/.jj`;
const JJ_REPO = `${REPO_ROOT}/.jj/repo`;
const WORKSPACES_DIR_DEFAULT = `${REPO_ROOT}__ws`;
const WORKSPACES_DIR_CUSTOM = `${REPO_ROOT}-ws`;

function mockSpawn(stdout: string, stderr: string, exitCode: number) {
  globalThis.Bun = {
    ...globalThis.Bun,
    spawn: vi.fn().mockReturnValue({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(stdout));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(stderr));
          controller.close();
        },
      }),
      exited: Promise.resolve(exitCode),
    }),
  };
}

describe("execCommand", () => {
  beforeEach(() => {
    mockSpawn("", "", 0);
  });

  test("returns stdout from the spawned process", async () => {
    mockSpawn("hello\n", "", 0);
    const result = await execCommand("echo", ["hello"]);
    expect(result.stdout).toBe("hello\n");
  });

  test("returns stderr from the spawned process", async () => {
    mockSpawn("", "something went wrong\n", 1);
    const result = await execCommand("false", []);
    expect(result.stderr).toBe("something went wrong\n");
  });

  test("returns exit code from the spawned process", async () => {
    mockSpawn("", "", 42);
    const result = await execCommand("exit", ["42"]);
    expect(result.exitCode).toBe(42);
  });

  test("returns exit code 0 on success", async () => {
    mockSpawn("ok", "", 0);
    const result = await execCommand("true", []);
    expect(result.exitCode).toBe(0);
  });

  test("passes command and args to Bun.spawn", async () => {
    mockSpawn("", "", 0);
    await execCommand("git", ["status", "--short"]);
    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["git", "status", "--short"],
      expect.objectContaining({ stdout: "pipe", stderr: "pipe" })
    );
  });

  test("uses provided cwd option", async () => {
    mockSpawn("", "", 0);
    await execCommand("ls", [], "/tmp");
    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["ls"],
      expect.objectContaining({ cwd: "/tmp" })
    );
  });

  test("falls back to process.cwd() when cwd is not provided", async () => {
    mockSpawn("", "", 0);
    const originalCwd = process.cwd();
    await execCommand("pwd", []);
    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["pwd"],
      expect.objectContaining({ cwd: originalCwd })
    );
  });

  test("handles empty stdout and stderr simultaneously", async () => {
    mockSpawn("", "", 0);
    const result = await execCommand("true", []);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  test("handles both stdout and stderr having content", async () => {
    mockSpawn("out\n", "err\n", 1);
    const result = await execCommand("cmd", []);
    expect(result.stdout).toBe("out\n");
    expect(result.stderr).toBe("err\n");
    expect(result.exitCode).toBe(1);
  });
});

describe("getRepoRoot", () => {
  const mockExistsSync = vi.mocked(existsSync);
  const originalCwd = process.cwd;

  beforeEach(() => {
    mockExistsSync.mockReset();
    process.cwd = originalCwd;
  });

  test("returns current directory when .jj exists there", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR);

    expect(getRepoRoot()).toBe(REPO_ROOT);
  });

  test("returns ancestor directory when .jj exists in parent", () => {
    process.cwd = () => `${REPO_ROOT}/src/deep`;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR);

    expect(getRepoRoot()).toBe(REPO_ROOT);
  });

  test("returns the nearest ancestor containing .jj", () => {
    process.cwd = () => "/a/b/c/d";
    mockExistsSync.mockImplementation((path) => path === "/a/b/.jj" || path === "/a/.jj");

    // /a/b matches first, so it is returned
    expect(getRepoRoot()).toBe("/a/b");
  });

  test("throws NotJujutsuRepositoryError when .jj is not found anywhere", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockReturnValue(false);

    expect(() => getRepoRoot()).toThrow(NotJujutsuRepositoryError);
  });

  test("throws NotJujutsuRepositoryError when starting from root", () => {
    process.cwd = () => "/";
    mockExistsSync.mockReturnValue(false);

    expect(() => getRepoRoot()).toThrow(NotJujutsuRepositoryError);
  });

  test("checks .jj path using JJ_DIR constant value", () => {
    process.cwd = () => "/repo";
    mockExistsSync.mockImplementation((path) => path === "/repo/.jj");

    getRepoRoot();

    expect(mockExistsSync).toHaveBeenCalledWith("/repo/.jj");
  });
});

describe("normalizeWorkspaceName", () => {
  test("replaces forward slashes with hyphens", () => {
    expect(normalizeWorkspaceName("feature/login")).toBe("feature-login");
  });

  test("replaces multiple forward slashes", () => {
    expect(normalizeWorkspaceName("feature/auth/login")).toBe("feature-auth-login");
  });

  test("returns unchanged string when no slashes", () => {
    expect(normalizeWorkspaceName("feature-login")).toBe("feature-login");
  });

  test("handles empty string", () => {
    expect(normalizeWorkspaceName("")).toBe("");
  });

  test("handles string with only slashes", () => {
    expect(normalizeWorkspaceName("///")).toBe("---");
  });
});

describe("getWorkspacesDirName", () => {
  test("uses provided suffix when valid string", () => {
    expect(getWorkspacesDirName("my-repo", "-ws")).toBe("my-repo-ws");
  });

  test("uses default suffix when undefined", () => {
    expect(getWorkspacesDirName("my-repo", undefined)).toBe("my-repo__ws");
  });

  test("uses provided suffix with underscore", () => {
    expect(getWorkspacesDirName("my-repo", "_workspaces")).toBe("my-repo_workspaces");
  });
});

describe("getWorkspacesDir", () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockStatSync = vi.mocked(statSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const originalCwd = process.cwd;

  beforeEach(() => {
    mockExistsSync.mockReset();
    mockStatSync.mockReset();
    mockReadFileSync.mockReset();
    process.cwd = originalCwd;
  });

  test("returns <parent>/<repoName>__ws when .jj/repo is a directory and no suffix given", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR || path === JJ_REPO);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);

    expect(getWorkspacesDir()).toBe(WORKSPACES_DIR_DEFAULT);
  });

  test("returns <parent>/<repoName><suffix> when custom suffix is provided", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR || path === JJ_REPO);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);

    expect(getWorkspacesDir("-ws")).toBe(WORKSPACES_DIR_CUSTOM);
  });

  test("resolves via .jj/repo file when in a linked workspace", () => {
    const workspacePath = `${WORKSPACES_DIR_DEFAULT}/feature-x`;
    process.cwd = () => workspacePath;
    mockExistsSync.mockImplementation(
      (path) => path === `${workspacePath}/.jj` || path === `${workspacePath}/.jj/repo`
    );
    mockStatSync.mockReturnValue({ isDirectory: () => false } as ReturnType<typeof statSync>);
    mockReadFileSync.mockReturnValue(JJ_REPO);

    expect(getWorkspacesDir()).toBe(WORKSPACES_DIR_DEFAULT);
  });

  test("resolves via .jj/repo file with custom suffix", () => {
    const workspacePath = `${WORKSPACES_DIR_CUSTOM}/feature-x`;
    process.cwd = () => workspacePath;
    mockExistsSync.mockImplementation(
      (path) => path === `${workspacePath}/.jj` || path === `${workspacePath}/.jj/repo`
    );
    mockStatSync.mockReturnValue({ isDirectory: () => false } as ReturnType<typeof statSync>);
    mockReadFileSync.mockReturnValue(JJ_REPO);

    expect(getWorkspacesDir("-ws")).toBe(WORKSPACES_DIR_CUSTOM);
  });

  test("uses empty string suffix when explicitly passed", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR || path === JJ_REPO);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);

    expect(getWorkspacesDir("")).toBe(REPO_ROOT);
  });

  test("throws when .jj/repo does not exist", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR);

    expect(() => getWorkspacesDir()).toThrow("Could not find .jj/repo");
  });

  test("throws NotJujutsuRepositoryError when .jj is not found", () => {
    process.cwd = () => "/home/user/no-repo";
    mockExistsSync.mockReturnValue(false);

    expect(() => getWorkspacesDir()).toThrow(NotJujutsuRepositoryError);
  });
});

describe("getWorkspacePath", () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockStatSync = vi.mocked(statSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const originalCwd = process.cwd;

  beforeEach(() => {
    mockExistsSync.mockReset();
    mockStatSync.mockReset();
    mockReadFileSync.mockReset();
    process.cwd = originalCwd;
  });

  test("returns <workspacesDir>/<name> when .jj/repo is a directory and no suffix given", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR || path === JJ_REPO);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);

    expect(getWorkspacePath("feature-x")).toBe(`${WORKSPACES_DIR_DEFAULT}/feature-x`);
  });

  test("returns <workspacesDir>/<name> with custom suffix", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR || path === JJ_REPO);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);

    expect(getWorkspacePath("feature-x", "-ws")).toBe(`${WORKSPACES_DIR_CUSTOM}/feature-x`);
  });

  test("resolves correctly when in a linked workspace via .jj/repo file", () => {
    const workspacePath = `${WORKSPACES_DIR_DEFAULT}/feature-x`;
    process.cwd = () => workspacePath;
    mockExistsSync.mockImplementation(
      (path) => path === `${workspacePath}/.jj` || path === `${workspacePath}/.jj/repo`
    );
    mockStatSync.mockReturnValue({ isDirectory: () => false } as ReturnType<typeof statSync>);
    mockReadFileSync.mockReturnValue(JJ_REPO);

    expect(getWorkspacePath("bugfix-1")).toBe(`${WORKSPACES_DIR_DEFAULT}/bugfix-1`);
  });

  test("resolves correctly when in a linked workspace with custom suffix", () => {
    const workspacePath = `${WORKSPACES_DIR_CUSTOM}/feature-x`;
    process.cwd = () => workspacePath;
    mockExistsSync.mockImplementation(
      (path) => path === `${workspacePath}/.jj` || path === `${workspacePath}/.jj/repo`
    );
    mockStatSync.mockReturnValue({ isDirectory: () => false } as ReturnType<typeof statSync>);
    mockReadFileSync.mockReturnValue(JJ_REPO);

    expect(getWorkspacePath("bugfix-1", "-ws")).toBe(`${WORKSPACES_DIR_CUSTOM}/bugfix-1`);
  });

  test("uses empty string suffix when explicitly passed", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR || path === JJ_REPO);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);

    expect(getWorkspacePath("feature-x", "")).toBe(`${REPO_ROOT}/feature-x`);
  });

  test("throws when .jj/repo does not exist", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR);

    expect(() => getWorkspacePath("feature-x")).toThrow("Could not find .jj/repo");
  });

  test("throws NotJujutsuRepositoryError when .jj is not found", () => {
    process.cwd = () => "/home/user/no-repo";
    mockExistsSync.mockReturnValue(false);

    expect(() => getWorkspacePath("feature-x")).toThrow(NotJujutsuRepositoryError);
  });
});

describe("copyFileOrDir", () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockStatSync = vi.mocked(statSync);
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    mockExistsSync.mockReset();
    mockStatSync.mockReset();
    warnSpy.mockClear();
    mockSpawn("", "", 0);
  });

  test("warns and returns early when source does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await copyFileOrDir("/src/missing", "/dest/missing");

    expect(warnSpy).toHaveBeenCalledWith("Source does not exist: /src/missing");
    expect(globalThis.Bun.spawn).not.toHaveBeenCalled();
  });

  test("calls cp without -r when source is a file", async () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as ReturnType<typeof statSync>);

    await copyFileOrDir("/src/file.txt", "/dest/file.txt");

    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["cp", "/src/file.txt", "/dest/file.txt"],
      expect.objectContaining({ stdout: "pipe", stderr: "pipe" })
    );
  });

  test("calls cp -r when source is a directory", async () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);

    await copyFileOrDir("/src/dir", "/dest/dir");

    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["cp", "-r", "/src/dir", "/dest/dir"],
      expect.objectContaining({ stdout: "pipe", stderr: "pipe" })
    );
  });

  test("passes src path to statSync to determine type", async () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as ReturnType<typeof statSync>);

    await copyFileOrDir("/src/check.txt", "/dest/check.txt");

    expect(mockStatSync).toHaveBeenCalledWith("/src/check.txt");
  });

  test("does not call statSync when source does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await copyFileOrDir("/src/nope", "/dest/nope");

    expect(mockStatSync).not.toHaveBeenCalled();
  });
});

describe("removeDir", () => {
  const mockExistsSync = vi.mocked(existsSync);

  beforeEach(() => {
    mockExistsSync.mockReset();
    mockSpawn("", "", 0);
  });

  test("calls rm -rf when path exists", async () => {
    mockExistsSync.mockReturnValue(true);

    await removeDir("/tmp/workspace");

    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["rm", "-rf", "/tmp/workspace"],
      expect.objectContaining({ stdout: "pipe", stderr: "pipe" })
    );
  });

  test("does not call rm when path does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await removeDir("/tmp/missing");

    expect(globalThis.Bun.spawn).not.toHaveBeenCalled();
  });

  test("checks existence using the provided path", async () => {
    mockExistsSync.mockReturnValue(false);

    await removeDir("/some/specific/path");

    expect(mockExistsSync).toHaveBeenCalledWith("/some/specific/path");
  });
});

describe("parseJjWorkspaceList", () => {
  test("returns empty array for empty output", () => {
    expect(parseJjWorkspaceList("")).toEqual([]);
  });

  test("returns empty array for whitespace output", () => {
    expect(parseJjWorkspaceList(" \n\t")).toEqual([]);
  });

  test("parses single workspace line", () => {
    expect(parseJjWorkspaceList("default: abc def")).toEqual(["default"]);
  });

  test("parses multiple workspace lines with spacing", () => {
    const output = " default: abc\nfeature-1: def \n  feature-2 : ghi";
    expect(parseJjWorkspaceList(output)).toEqual(["default", "feature-1", "feature-2"]);
  });

  test("ignores lines without a valid name", () => {
    const output = "invalid line\n: missing-name\nok: id";
    expect(parseJjWorkspaceList(output)).toEqual(["ok"]);
  });
});

describe("getJjWorkspaceList", () => {
  beforeEach(() => {
    mockSpawn("", "", 0);
  });

  test("returns parsed workspace names on success", async () => {
    mockSpawn("default: abc123\nfeature-x: def456\n", "", 0);

    const result = await getJjWorkspaceList();

    expect(result).toEqual(["default", "feature-x"]);
  });

  test("returns empty array when jj outputs no workspaces", async () => {
    mockSpawn("", "", 0);

    const result = await getJjWorkspaceList();

    expect(result).toEqual([]);
  });

  test("invokes jj with workspace list arguments", async () => {
    mockSpawn("default: abc\n", "", 0);

    await getJjWorkspaceList();

    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["jj", "workspace", "list"],
      expect.objectContaining({ stdout: "pipe", stderr: "pipe" })
    );
  });

  test("throws JujutsuCommandError when jj exits with non-zero code", async () => {
    mockSpawn("", "fatal: not a jj repo\n", 1);

    await expect(getJjWorkspaceList()).rejects.toThrow(JujutsuCommandError);
  });

  test("includes stderr in the error message on failure", async () => {
    mockSpawn("", "something went wrong\n", 1);

    await expect(getJjWorkspaceList()).rejects.toThrow("something went wrong");
  });

  test("returns single workspace when only one exists", async () => {
    mockSpawn("default: abc123 def456\n", "", 0);

    const result = await getJjWorkspaceList();

    expect(result).toEqual(["default"]);
  });

  test("handles whitespace-only stdout as empty list", async () => {
    mockSpawn("  \n\t\n", "", 0);

    const result = await getJjWorkspaceList();

    expect(result).toEqual([]);
  });
});

describe("getChangeIdFromWorkspaceList", () => {
  test("extracts change_id for given workspace name", () => {
    const output = "default: abc123 commit456\nfeature-x: def789 commit000\n";
    expect(getChangeIdFromWorkspaceList(output, "feature-x")).toBe("def789");
  });

  test("extracts change_id for default workspace", () => {
    const output = "default: abc123 commit456\nfeature-x: def789 commit000\n";
    expect(getChangeIdFromWorkspaceList(output, "default")).toBe("abc123");
  });

  test("returns null when workspace not found", () => {
    const output = "default: abc123 commit456\nfeature-x: def789 commit000\n";
    expect(getChangeIdFromWorkspaceList(output, "nonexistent")).toBeNull();
  });

  test("returns null for empty output", () => {
    expect(getChangeIdFromWorkspaceList("", "default")).toBeNull();
  });

  test("handles whitespace around workspace name", () => {
    const output = "  feature-x : def789 commit000  \n";
    expect(getChangeIdFromWorkspaceList(output, "feature-x")).toBe("def789");
  });

  test("returns null when line has no space after colon", () => {
    const output = "feature-x:\n";
    expect(getChangeIdFromWorkspaceList(output, "feature-x")).toBeNull();
  });
});

describe("getCurrentWorkspaceName", () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockStatSync = vi.mocked(statSync);
  const originalCwd = process.cwd;
  const mockReadFileSync = vi.mocked(readFileSync);

  beforeEach(() => {
    mockExistsSync.mockReset();
    mockStatSync.mockReset();
    mockReadFileSync.mockReset();
    process.cwd = originalCwd;
  });

  test("returns 'default' when in default workspace", () => {
    process.cwd = () => REPO_ROOT;
    mockExistsSync.mockImplementation((path) => path === JJ_DIR || path === JJ_REPO);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);

    expect(getCurrentWorkspaceName()).toBe("default");
  });

  test("returns workspace name when in non-default workspace", () => {
    const workspacePath = `${WORKSPACES_DIR_DEFAULT}/feature-x`;
    process.cwd = () => workspacePath;
    mockExistsSync.mockImplementation(
      (path) => path === `${workspacePath}/.jj` || path === `${workspacePath}/.jj/repo`
    );
    mockStatSync.mockReturnValue({ isDirectory: () => false } as ReturnType<typeof statSync>);
    mockReadFileSync.mockReturnValue(JJ_REPO);

    expect(getCurrentWorkspaceName()).toBe("feature-x");
  });

  test("handles workspace names with hyphens", () => {
    const workspacePath = `${WORKSPACES_DIR_DEFAULT}/feature-auth-login`;
    process.cwd = () => workspacePath;
    mockExistsSync.mockImplementation(
      (path) => path === `${workspacePath}/.jj` || path === `${workspacePath}/.jj/repo`
    );
    mockStatSync.mockReturnValue({ isDirectory: () => false } as ReturnType<typeof statSync>);
    mockReadFileSync.mockReturnValue(JJ_REPO);

    expect(getCurrentWorkspaceName()).toBe("feature-auth-login");
  });
});
