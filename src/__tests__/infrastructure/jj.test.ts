import { beforeEach, describe, expect, test, vi } from "vitest";
import { JujutsuCommandError, NotJujutsuRepositoryError } from "../../controller/errors.ts";
import type { CommandRunner } from "../../controller/ports.ts";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}));

import { existsSync, readFileSync, statSync } from "node:fs";
import {
  createJujutsuCli,
  getChangeIdFromWorkspaceList,
  parseJjWorkspaceList,
} from "../../infrastructure/jj.ts";

const REPO_ROOT = "/home/user/my-repo";
const JJ_REPO = `${REPO_ROOT}/.jj/repo`;
const LINKED = `${REPO_ROOT}__ws/feature-x`;

const run = vi.fn();
const jj = createJujutsuCli({ run } as CommandRunner);

function ok(stdout = "") {
  run.mockResolvedValue({ stdout, stderr: "", exitCode: 0 });
}

function fail(stderr: string) {
  run.mockResolvedValue({ stdout: "", stderr, exitCode: 1 });
}

function mockRepoRoot(root: string | null) {
  globalThis.Bun = {
    ...globalThis.Bun,
    spawnSync: vi.fn().mockReturnValue({
      stdout: Buffer.from(root === null ? "" : `${root}\n`),
      stderr: Buffer.from(""),
      exitCode: root === null ? 1 : 0,
    }),
  };
}

function mockRepoLayout(root: string, repoIsDir: boolean, pointer?: string) {
  mockRepoRoot(root);
  vi.mocked(existsSync).mockImplementation((path) => path === `${root}/.jj/repo`);
  vi.mocked(statSync).mockReturnValue({ isDirectory: () => repoIsDir } as ReturnType<
    typeof statSync
  >);
  if (pointer !== undefined) vi.mocked(readFileSync).mockReturnValue(pointer);
}

beforeEach(() => {
  run.mockReset();
  vi.mocked(existsSync).mockReset();
  vi.mocked(statSync).mockReset();
  vi.mocked(readFileSync).mockReset();
});

describe("getWorkspaceRoot", () => {
  test("returns the trimmed output of jj workspace root", () => {
    mockRepoRoot(REPO_ROOT);
    expect(jj.getWorkspaceRoot()).toBe(REPO_ROOT);
    expect(Bun.spawnSync).toHaveBeenCalledWith(
      ["jj", "workspace", "root", "--ignore-working-copy"],
      expect.objectContaining({ cwd: process.cwd() })
    );
  });

  test("throws NotJujutsuRepositoryError when jj fails", () => {
    mockRepoRoot(null);
    expect(() => jj.getWorkspaceRoot()).toThrow(NotJujutsuRepositoryError);
  });
});

describe("getDefaultWorkspacePath", () => {
  test("returns the current root when .jj/repo is a directory", () => {
    mockRepoLayout(REPO_ROOT, true);
    expect(jj.getDefaultWorkspacePath()).toBe(REPO_ROOT);
  });

  test("follows an absolute .jj/repo pointer in a linked workspace", () => {
    mockRepoLayout(LINKED, false, JJ_REPO);
    expect(jj.getDefaultWorkspacePath()).toBe(REPO_ROOT);
  });

  test("resolves a relative .jj/repo pointer", () => {
    mockRepoLayout(LINKED, false, "../../../my-repo/.jj/repo");
    expect(jj.getDefaultWorkspacePath()).toBe(REPO_ROOT);
  });

  test("throws when .jj/repo does not exist", () => {
    mockRepoRoot(REPO_ROOT);
    vi.mocked(existsSync).mockReturnValue(false);
    expect(() => jj.getDefaultWorkspacePath()).toThrow("Could not find .jj/repo");
  });

  test("throws NotJujutsuRepositoryError outside a repository", () => {
    mockRepoRoot(null);
    expect(() => jj.getDefaultWorkspacePath()).toThrow(NotJujutsuRepositoryError);
  });
});

describe("listWorkspaceNames", () => {
  test("returns parsed workspace names", async () => {
    ok("default: abc123\nfeature-x: def456\n");
    expect(await jj.listWorkspaceNames()).toEqual(["default", "feature-x"]);
    expect(run).toHaveBeenCalledWith("jj", ["workspace", "list"], undefined);
  });

  test("throws JujutsuCommandError with stderr on failure", async () => {
    fail("something went wrong\n");
    await expect(jj.listWorkspaceNames()).rejects.toThrow(JujutsuCommandError);
    await expect(jj.listWorkspaceNames()).rejects.toThrow("something went wrong");
  });
});

describe("findChangeId", () => {
  test("returns the change id of the workspace", async () => {
    ok("default: abc123 c1\nfeature-x: def789 c2\n");
    expect(await jj.findChangeId("feature-x")).toBe("def789");
  });

  test("returns null when the workspace is missing", async () => {
    ok("default: abc123 c1\n");
    expect(await jj.findChangeId("nonexistent")).toBeNull();
  });

  test("throws JujutsuCommandError when jj fails", async () => {
    fail("fatal");
    await expect(jj.findChangeId("x")).rejects.toThrow(JujutsuCommandError);
  });
});

describe("mutating commands", () => {
  test("addWorkspace without revision", async () => {
    ok();
    await jj.addWorkspace("feature", "/ws/feature");
    expect(run).toHaveBeenCalledWith(
      "jj",
      ["workspace", "add", "--name", "feature", "/ws/feature"],
      undefined
    );
  });

  test("addWorkspace with revision", async () => {
    ok();
    await jj.addWorkspace("feature", "/ws/feature", "abc");
    expect(run).toHaveBeenCalledWith(
      "jj",
      ["workspace", "add", "--name", "feature", "--revision", "abc", "/ws/feature"],
      undefined
    );
  });

  test("forgetWorkspace", async () => {
    ok();
    await jj.forgetWorkspace("feature");
    expect(run).toHaveBeenCalledWith("jj", ["workspace", "forget", "feature"], undefined);
  });

  test("renameWorkspace runs in the given cwd", async () => {
    ok();
    await jj.renameWorkspace("new", "/ws/old");
    expect(run).toHaveBeenCalledWith("jj", ["workspace", "rename", "new"], "/ws/old");
  });

  test("edit runs in the given cwd", async () => {
    ok();
    await jj.edit("abc", "/repo");
    expect(run).toHaveBeenCalledWith("jj", ["edit", "abc"], "/repo");
  });

  test.each([
    ["addWorkspace", () => jj.addWorkspace("a", "/p"), "create workspace"],
    ["forgetWorkspace", () => jj.forgetWorkspace("a"), "forget workspace"],
    ["renameWorkspace", () => jj.renameWorkspace("a", "/p"), "rename workspace"],
    ["edit", () => jj.edit("a", "/p"), "edit revision"],
  ])("%s throws JujutsuCommandError on failure", async (_name, call, operation) => {
    fail("nope");
    await expect(call()).rejects.toThrow(JujutsuCommandError);
    await expect(call()).rejects.toThrow(`Failed to ${operation}: nope`);
  });
});

describe("parseJjWorkspaceList", () => {
  test("returns empty array for empty or whitespace output", () => {
    expect(parseJjWorkspaceList("")).toEqual([]);
    expect(parseJjWorkspaceList(" \n\t")).toEqual([]);
  });

  test("parses lines with spacing", () => {
    expect(parseJjWorkspaceList(" default: abc\nfeature-1: def \n  feature-2 : ghi")).toEqual([
      "default",
      "feature-1",
      "feature-2",
    ]);
  });

  test("ignores lines without a valid name", () => {
    expect(parseJjWorkspaceList("invalid line\n: missing-name\nok: id")).toEqual(["ok"]);
  });
});

describe("getChangeIdFromWorkspaceList", () => {
  const output = "default: abc123 commit456\nfeature-x: def789 commit000\n";

  test("extracts change_id for given workspace name", () => {
    expect(getChangeIdFromWorkspaceList(output, "feature-x")).toBe("def789");
    expect(getChangeIdFromWorkspaceList(output, "default")).toBe("abc123");
  });

  test("returns null when workspace not found or output empty", () => {
    expect(getChangeIdFromWorkspaceList(output, "nonexistent")).toBeNull();
    expect(getChangeIdFromWorkspaceList("", "default")).toBeNull();
  });

  test("handles whitespace around workspace name", () => {
    expect(getChangeIdFromWorkspaceList("  feature-x : def789 commit000  \n", "feature-x")).toBe(
      "def789"
    );
  });

  test("returns null when line has no change id", () => {
    expect(getChangeIdFromWorkspaceList("feature-x:\n", "feature-x")).toBeNull();
  });
});
