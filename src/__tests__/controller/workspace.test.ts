import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { JujutsuCommandError } from "@/controller/errors.ts";
import type {
  CommandRunner,
  ConfigRepository,
  Deps,
  FileSystem,
  Jujutsu,
} from "@/controller/ports.ts";
import * as workspace from "@/controller/workspace.ts";
import {
  CannotRemoveCurrentWorkspaceError,
  CannotRemoveDefaultWorkspaceError,
  CannotRenameCurrentWorkspaceError,
  CannotRenameDefaultWorkspaceError,
  ConfigAlreadyExistsError,
  NotDefaultWorkspaceError,
  ValidationError,
  WorkspaceExistsError,
  WorkspaceNotFoundError,
} from "@/domain/errors.ts";
import { DEFAULT_WORKSPACE_NAME } from "@/domain/workspace.ts";

const defaultConfig = { copyFiles: [], postCreateCommands: [], workspacesDirSuffix: "__ws" };

function createFakeDeps() {
  const jj = {
    getWorkspaceRoot: vi.fn<Jujutsu["getWorkspaceRoot"]>(() => "/repo"),
    getDefaultWorkspacePath: vi.fn<Jujutsu["getDefaultWorkspacePath"]>(() => "/repo"),
    listWorkspaceNames: vi.fn<Jujutsu["listWorkspaceNames"]>(async () => []),
    findChangeId: vi.fn<Jujutsu["findChangeId"]>(async () => "abc123"),
    addWorkspace: vi.fn<Jujutsu["addWorkspace"]>(async () => {}),
    forgetWorkspace: vi.fn<Jujutsu["forgetWorkspace"]>(async () => {}),
    renameWorkspace: vi.fn<Jujutsu["renameWorkspace"]>(async () => {}),
    edit: vi.fn<Jujutsu["edit"]>(async () => {}),
  };
  const fs = {
    exists: vi.fn<FileSystem["exists"]>(() => false),
    makeDir: vi.fn<FileSystem["makeDir"]>(async () => {}),
    copy: vi.fn<FileSystem["copy"]>(async () => {}),
    remove: vi.fn<FileSystem["remove"]>(async () => {}),
    move: vi.fn<FileSystem["move"]>(async () => {}),
  };
  const runner = {
    run: vi.fn<CommandRunner["run"]>(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
  };
  const config = {
    path: vi.fn<ConfigRepository["path"]>(() => "/repo/.jwconfig"),
    exists: vi.fn<ConfigRepository["exists"]>(() => false),
    load: vi.fn<ConfigRepository["load"]>(async () => ({ ...defaultConfig })),
    save: vi.fn<ConfigRepository["save"]>(async () => {}),
  };
  return { jj, fs, runner, config, deps: { jj, fs, runner, config } as Deps };
}

let t: ReturnType<typeof createFakeDeps>;
let deps: Deps;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

function existing(...paths: string[]) {
  t.fs.exists.mockImplementation((path: string) => paths.includes(path));
}

beforeEach(() => {
  t = createFakeDeps();
  deps = t.deps;
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("newWorkspace", () => {
  test("throws when workspace already exists", async () => {
    existing("/repo__ws/feature");
    await expect(workspace.newWorkspace(deps, "feature")).rejects.toBeInstanceOf(
      WorkspaceExistsError
    );
    expect(t.jj.addWorkspace).not.toHaveBeenCalled();
  });

  test("creates the workspaces dir and the workspace with revision", async () => {
    await workspace.newWorkspace(deps, "feature", "abc123");

    expect(t.fs.makeDir).toHaveBeenCalledWith("/repo__ws");
    expect(t.jj.addWorkspace).toHaveBeenCalledWith("feature", "/repo__ws/feature", "abc123");
  });

  test("honors workspacesDirSuffix and normalizes the name", async () => {
    t.config.load.mockResolvedValue({ ...defaultConfig, workspacesDirSuffix: "-ws" });
    await workspace.newWorkspace(deps, "feat/x");
    expect(t.jj.addWorkspace).toHaveBeenCalledWith("feat-x", "/repo-ws/feat-x", undefined);
  });

  test("copies configured files to new workspace", async () => {
    t.config.load.mockResolvedValue({ ...defaultConfig, copyFiles: ["README.md", ".env"] });
    existing("/repo/README.md", "/repo/.env");

    await workspace.newWorkspace(deps, "feature");

    expect(t.fs.copy).toHaveBeenCalledWith("/repo/README.md", "/repo__ws/feature");
    expect(t.fs.copy).toHaveBeenCalledWith("/repo/.env", "/repo__ws/feature");
  });

  test("warns and skips copy when a source does not exist", async () => {
    t.config.load.mockResolvedValue({ ...defaultConfig, copyFiles: [".env"] });

    await workspace.newWorkspace(deps, "feature");

    expect(warnSpy).toHaveBeenCalledWith("Source does not exist: /repo/.env");
    expect(t.fs.copy).not.toHaveBeenCalled();
  });

  test("warns when post-create command fails and continues", async () => {
    t.config.load.mockResolvedValue({
      ...defaultConfig,
      postCreateCommands: ["npm install", "bun test"],
    });
    t.runner.run.mockResolvedValueOnce({ stdout: "", stderr: "boom", exitCode: 1 });

    await workspace.newWorkspace(deps, "feature");

    expect(t.runner.run).toHaveBeenCalledWith("npm", ["install"], "/repo__ws/feature");
    expect(t.runner.run).toHaveBeenCalledWith("bun", ["test"], "/repo__ws/feature");
    expect(warnSpy).toHaveBeenCalledWith("Command failed: npm install");
    expect(warnSpy).toHaveBeenCalledWith("boom");
  });

  test("propagates jj add failure without copying", async () => {
    t.jj.addWorkspace.mockRejectedValue(new JujutsuCommandError("create workspace", "nope"));
    t.config.load.mockResolvedValue({ ...defaultConfig, copyFiles: [".env"] });

    await expect(workspace.newWorkspace(deps, "feature")).rejects.toBeInstanceOf(
      JujutsuCommandError
    );
    expect(t.fs.copy).not.toHaveBeenCalled();
  });
});

describe("listWorkspaces", () => {
  test("logs workspaces with default and missing markers", async () => {
    t.jj.listWorkspaceNames.mockResolvedValue(["default", "feature", "stale"]);
    existing("/repo__ws/feature");

    await workspace.listWorkspaces(deps);

    expect(logSpy).toHaveBeenNthCalledWith(1, "* default (/repo)");
    expect(logSpy).toHaveBeenNthCalledWith(2, "  feature (/repo__ws/feature)");
    expect(logSpy).toHaveBeenNthCalledWith(3, "  stale ✗");
  });
});

describe("goWorkspace", () => {
  test("prints default workspace path without loading config", async () => {
    await workspace.goWorkspace(deps, DEFAULT_WORKSPACE_NAME);
    expect(logSpy).toHaveBeenCalledWith("/repo");
    expect(t.config.load).not.toHaveBeenCalled();
  });

  test("throws when workspace is missing", async () => {
    await expect(workspace.goWorkspace(deps, "feature")).rejects.toBeInstanceOf(
      WorkspaceNotFoundError
    );
  });

  test("prints workspace path when it exists", async () => {
    existing("/repo__ws/feature");
    await workspace.goWorkspace(deps, "feature");
    expect(logSpy).toHaveBeenCalledWith("/repo__ws/feature");
  });
});

describe("removeWorkspace", () => {
  test("throws when removing default workspace", async () => {
    await expect(workspace.removeWorkspace(deps, DEFAULT_WORKSPACE_NAME)).rejects.toBeInstanceOf(
      CannotRemoveDefaultWorkspaceError
    );
  });

  test("throws when removing the current workspace", async () => {
    t.jj.getWorkspaceRoot.mockReturnValue("/repo__ws/feature");

    await expect(workspace.removeWorkspace(deps, "feature")).rejects.toBeInstanceOf(
      CannotRemoveCurrentWorkspaceError
    );
    expect(t.jj.forgetWorkspace).not.toHaveBeenCalled();
    expect(t.fs.remove).not.toHaveBeenCalled();
  });

  test("forgets and removes workspace", async () => {
    existing("/repo__ws/feature");

    await workspace.removeWorkspace(deps, "feature");

    expect(t.jj.forgetWorkspace).toHaveBeenCalledWith("feature");
    expect(t.fs.remove).toHaveBeenCalledWith("/repo__ws/feature");
    expect(logSpy).toHaveBeenCalledWith('Removed workspace "feature"');
  });

  test("throws and keeps the directory when jj forget fails", async () => {
    existing("/repo__ws/feature");
    t.jj.forgetWorkspace.mockRejectedValue(new JujutsuCommandError("forget workspace", "boom"));

    await expect(workspace.removeWorkspace(deps, "feature")).rejects.toBeInstanceOf(
      JujutsuCommandError
    );
    expect(t.fs.remove).not.toHaveBeenCalled();
  });
});

describe("copyToWorkspace", () => {
  test("throws when workspace is missing", async () => {
    await expect(workspace.copyToWorkspace(deps, "feature")).rejects.toBeInstanceOf(
      WorkspaceNotFoundError
    );
  });

  test("copies files to workspace", async () => {
    t.config.load.mockResolvedValue({ ...defaultConfig, copyFiles: ["README.md"] });
    existing("/repo__ws/feature", "/repo/README.md");

    await workspace.copyToWorkspace(deps, "feature");

    expect(t.fs.copy).toHaveBeenCalledWith("/repo/README.md", "/repo__ws/feature");
    expect(logSpy).toHaveBeenCalledWith("Copy completed");
  });
});

describe("renameWorkspace", () => {
  test("throws when renaming the default workspace", async () => {
    await expect(
      workspace.renameWorkspace(deps, DEFAULT_WORKSPACE_NAME, "new")
    ).rejects.toBeInstanceOf(CannotRenameDefaultWorkspaceError);
    expect(t.jj.renameWorkspace).not.toHaveBeenCalled();
  });

  test("throws when renaming the current workspace", async () => {
    t.jj.getWorkspaceRoot.mockReturnValue("/repo__ws/old");

    await expect(workspace.renameWorkspace(deps, "old", "new")).rejects.toBeInstanceOf(
      CannotRenameCurrentWorkspaceError
    );
    expect(t.jj.renameWorkspace).not.toHaveBeenCalled();
  });

  test("throws when old workspace is missing", async () => {
    await expect(workspace.renameWorkspace(deps, "old", "new")).rejects.toBeInstanceOf(
      WorkspaceNotFoundError
    );
  });

  test("throws when new workspace already exists", async () => {
    existing("/repo__ws/old", "/repo__ws/new");
    await expect(workspace.renameWorkspace(deps, "old", "new")).rejects.toBeInstanceOf(
      WorkspaceExistsError
    );
  });

  test("keeps the directory when jj rename fails", async () => {
    existing("/repo__ws/old");
    t.jj.renameWorkspace.mockRejectedValue(new JujutsuCommandError("rename workspace", "failed"));

    await expect(workspace.renameWorkspace(deps, "old", "new")).rejects.toBeInstanceOf(
      JujutsuCommandError
    );
    expect(t.fs.move).not.toHaveBeenCalled();
  });

  test("renames in jj then moves the directory", async () => {
    existing("/repo__ws/old");

    await workspace.renameWorkspace(deps, "old", "new");

    expect(t.jj.renameWorkspace).toHaveBeenCalledWith("new", "/repo__ws/old");
    expect(t.fs.move).toHaveBeenCalledWith("/repo__ws/old", "/repo__ws/new");
    expect(logSpy).toHaveBeenCalledWith('Renamed workspace "old" to "new"');
  });
});

describe("cleanWorkspaces", () => {
  test("logs when no stale workspaces are found", async () => {
    t.jj.listWorkspaceNames.mockResolvedValue(["default", "feature"]);
    existing("/repo__ws/feature");

    await workspace.cleanWorkspaces(deps);

    expect(logSpy).toHaveBeenCalledWith("No stale workspaces found");
    expect(t.jj.forgetWorkspace).not.toHaveBeenCalled();
  });

  test("forgets missing workspaces and warns on failures", async () => {
    t.jj.listWorkspaceNames.mockResolvedValue(["default", "gone", "fail"]);
    t.jj.forgetWorkspace
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new JujutsuCommandError("forget workspace", "boom\n"));

    await workspace.cleanWorkspaces(deps);

    expect(logSpy).toHaveBeenCalledWith("Forgotten workspaces:");
    expect(logSpy).toHaveBeenCalledWith("  gone");
    expect(warnSpy).toHaveBeenCalledWith('Failed to forget workspace "fail": boom');
  });

  test("rethrows unexpected errors", async () => {
    t.jj.listWorkspaceNames.mockResolvedValue(["gone"]);
    t.jj.forgetWorkspace.mockRejectedValue(new Error("unexpected"));

    await expect(workspace.cleanWorkspaces(deps)).rejects.toThrow("unexpected");
  });
});

describe("initWorkspace", () => {
  test("saves default config and logs path", async () => {
    await workspace.initWorkspace(deps);

    expect(t.jj.getWorkspaceRoot).toHaveBeenCalled();
    expect(t.config.save).toHaveBeenCalledWith(defaultConfig);
    expect(logSpy).toHaveBeenCalledWith("Initialized jw config: /repo/.jwconfig");
  });

  test("throws when config already exists", async () => {
    t.config.exists.mockReturnValue(true);

    await expect(workspace.initWorkspace(deps)).rejects.toBeInstanceOf(ConfigAlreadyExistsError);
    expect(t.config.save).not.toHaveBeenCalled();
  });
});

describe("thisWorkspace", () => {
  beforeEach(() => {
    t.jj.getWorkspaceRoot.mockReturnValue("/repo__ws/feature-x");
    t.jj.findChangeId.mockResolvedValue("def789");
  });

  test("throws ValidationError when in default workspace", async () => {
    t.jj.getWorkspaceRoot.mockReturnValue("/repo");

    await expect(workspace.thisWorkspace(deps)).rejects.toBeInstanceOf(ValidationError);
    await expect(workspace.thisWorkspace(deps)).rejects.toThrow(
      "Cannot run 'jw this' from default workspace"
    );
  });

  test("edits the current change in the default workspace directory", async () => {
    await workspace.thisWorkspace(deps);

    expect(t.jj.findChangeId).toHaveBeenCalledWith("feature-x");
    expect(t.jj.edit).toHaveBeenCalledWith("def789", "/repo");
    expect(logSpy).toHaveBeenCalledWith('Switched default workspace to "feature-x" (def789)');
  });

  test("throws ValidationError when current workspace is not in the list", async () => {
    t.jj.findChangeId.mockResolvedValue(null);

    await expect(workspace.thisWorkspace(deps)).rejects.toBeInstanceOf(ValidationError);
    await expect(workspace.thisWorkspace(deps)).rejects.toThrow(
      'Current workspace "feature-x" not found in jj workspace list'
    );
  });

  test("propagates jj errors", async () => {
    t.jj.edit.mockRejectedValue(new JujutsuCommandError("edit revision", "no such revision"));

    await expect(workspace.thisWorkspace(deps)).rejects.toThrow("no such revision");
  });
});

describe("useWorkspace", () => {
  test("throws ValidationError when name is empty", async () => {
    await expect(workspace.useWorkspace(deps, "")).rejects.toBeInstanceOf(ValidationError);
  });

  test("throws ValidationError when name is default", async () => {
    await expect(workspace.useWorkspace(deps, "default")).rejects.toThrow(
      "Cannot use the default workspace"
    );
  });

  test("throws NotDefaultWorkspaceError when not in default workspace", async () => {
    t.jj.getWorkspaceRoot.mockReturnValue("/repo__ws/feature");

    await expect(workspace.useWorkspace(deps, "feature-x")).rejects.toBeInstanceOf(
      NotDefaultWorkspaceError
    );
  });

  test("edits the target change in the default workspace and logs", async () => {
    t.jj.findChangeId.mockResolvedValue("def789");

    await workspace.useWorkspace(deps, "feature-x");

    expect(t.jj.findChangeId).toHaveBeenCalledWith("feature-x");
    expect(t.jj.edit).toHaveBeenCalledWith("def789", "/repo");
    expect(logSpy).toHaveBeenCalledWith('Switched default workspace to "feature-x" (def789)');
  });

  test("throws WorkspaceNotFoundError when workspace does not exist", async () => {
    t.jj.findChangeId.mockResolvedValue(null);

    await expect(workspace.useWorkspace(deps, "nonexistent")).rejects.toBeInstanceOf(
      WorkspaceNotFoundError
    );
    expect(t.jj.edit).not.toHaveBeenCalled();
  });

  test("propagates jj edit failure", async () => {
    t.jj.edit.mockRejectedValue(new JujutsuCommandError("edit revision", "boom"));

    await expect(workspace.useWorkspace(deps, "feature-x")).rejects.toBeInstanceOf(
      JujutsuCommandError
    );
  });
});
