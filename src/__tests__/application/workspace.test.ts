import { describe, expect, test } from "vitest";
import type { RepoContext } from "@/application/workspace.ts";
import * as app from "@/application/workspace.ts";
import {
  CannotRemoveCurrentWorkspaceError,
  CannotRemoveDefaultWorkspaceError,
  CannotRenameCurrentWorkspaceError,
  CannotRenameDefaultWorkspaceError,
  ConfigAlreadyExistsError,
  InvalidWorkspaceNameError,
  NotDefaultWorkspaceError,
  ValidationError,
  WorkspaceExistsError,
  WorkspaceNotFoundError,
} from "@/domain/errors.ts";

function ctx(overrides: Partial<RepoContext> = {}): RepoContext {
  return {
    defaultWorkspacePath: "/repo",
    currentWorkspaceRoot: "/repo",
    config: { copyFiles: [], postCreateCommands: [], workspacesDirSuffix: "__ws" },
    ...overrides,
  };
}

const loc = (name: string) => ({ name, path: `/repo__ws/${name}` });

describe("formatDefaultWorkspaceLine", () => {
  test("marks default workspace when current path matches", () => {
    expect(app.formatDefaultWorkspaceLine("/repo", "/repo")).toBe("* default (/repo)");
  });

  test("uses blank mark when current path differs", () => {
    expect(app.formatDefaultWorkspaceLine("/repo", "/other")).toBe("  default (/repo)");
  });
});

describe("formatWorkspaceLine", () => {
  test("marks workspace when current path matches", () => {
    expect(app.formatWorkspaceLine("feature", "/repo__ws/feature", "/repo__ws/feature", true)).toBe(
      "* feature (/repo__ws/feature)"
    );
  });

  test("uses blank mark when current path differs", () => {
    expect(app.formatWorkspaceLine("feature", "/repo__ws/feature", "/repo", true)).toBe(
      "  feature (/repo__ws/feature)"
    );
  });

  test("prints missing workspace marker when path does not exist", () => {
    expect(app.formatWorkspaceLine("feature", "/repo__ws/feature", "/repo", false)).toBe(
      "  feature ✗"
    );
  });
});

describe("locateWorkspace", () => {
  test("resolves the path under the workspaces dir", () => {
    expect(app.locateWorkspace(ctx(), "feature")).toEqual(loc("feature"));
  });

  test("normalizes slashes in the name", () => {
    expect(app.locateWorkspace(ctx(), "feat/x")).toEqual({
      name: "feat-x",
      path: "/repo__ws/feat-x",
    });
  });

  test("honors workspacesDirSuffix", () => {
    const c = ctx({
      config: { copyFiles: [], postCreateCommands: [], workspacesDirSuffix: "-ws" },
    });
    expect(app.locateWorkspace(c, "feature").path).toBe("/repo-ws/feature");
  });

  test("resolves relative to the default workspace even from a linked workspace", () => {
    const c = ctx({ currentWorkspaceRoot: "/repo__ws/other" });
    expect(app.locateWorkspace(c, "feature").path).toBe("/repo__ws/feature");
  });

  test("rejects unsafe names", () => {
    expect(() => app.locateWorkspace(ctx(), "..")).toThrow(InvalidWorkspaceNameError);
  });
});

describe("locateNonDefaultWorkspaces", () => {
  test("skips default and keeps the names jj reported", () => {
    expect(app.locateNonDefaultWorkspaces(ctx(), ["default", "feature", "a/b"])).toEqual([
      loc("feature"),
      { name: "a/b", path: "/repo__ws/a-b" },
    ]);
  });
});

describe("planCopy", () => {
  test("joins copy files onto the current workspace root", () => {
    const c = ctx({
      currentWorkspaceRoot: "/repo__ws/other",
      config: { copyFiles: [".env", "dir"], postCreateCommands: [] },
    });
    expect(app.planCopy(c)).toEqual([
      { file: ".env", path: "/repo__ws/other/.env" },
      { file: "dir", path: "/repo__ws/other/dir" },
    ]);
  });
});

describe("planNewWorkspace", () => {
  test("combines location, workspaces dir, copy sources and commands", () => {
    const c = ctx({
      config: {
        copyFiles: [".env"],
        postCreateCommands: ["npm install", "bun"],
        workspacesDirSuffix: "__ws",
      },
    });

    expect(app.planNewWorkspace(c, "feature")).toEqual({
      location: loc("feature"),
      workspacesDir: "/repo__ws",
      copySources: [{ file: ".env", path: "/repo/.env" }],
      postCreateCommands: [
        { line: "npm install", command: "npm", args: ["install"] },
        { line: "bun", command: "bun", args: [] },
      ],
    });
  });
});

describe("assertCanCreate / assertWorkspaceExists", () => {
  test("assertCanCreate throws when the workspace exists", () => {
    expect(() => app.assertCanCreate(loc("f"), true)).toThrow(WorkspaceExistsError);
    expect(() => app.assertCanCreate(loc("f"), false)).not.toThrow();
  });

  test("assertWorkspaceExists throws when the workspace is missing", () => {
    expect(() => app.assertWorkspaceExists(loc("f"), false)).toThrow(WorkspaceNotFoundError);
    expect(() => app.assertWorkspaceExists(loc("f"), true)).not.toThrow();
  });
});

describe("assertCanRemove", () => {
  test("throws for the default workspace", () => {
    expect(() =>
      app.assertCanRemove({ name: "default", path: "/repo__ws/default" }, ctx())
    ).toThrow(CannotRemoveDefaultWorkspaceError);
  });

  test("throws for the current workspace", () => {
    const c = ctx({ currentWorkspaceRoot: "/repo__ws/feature" });
    expect(() => app.assertCanRemove(loc("feature"), c)).toThrow(CannotRemoveCurrentWorkspaceError);
  });

  test("passes for another workspace", () => {
    expect(() => app.assertCanRemove(loc("feature"), ctx())).not.toThrow();
  });
});

describe("assertCanRename", () => {
  const facts = { oldExists: true, newExists: false };

  test("throws for the default workspace", () => {
    expect(() =>
      app.assertCanRename({ name: "default", path: "/x" }, loc("new"), ctx(), facts)
    ).toThrow(CannotRenameDefaultWorkspaceError);
  });

  test("throws for the current workspace", () => {
    const c = ctx({ currentWorkspaceRoot: "/repo__ws/old" });
    expect(() => app.assertCanRename(loc("old"), loc("new"), c, facts)).toThrow(
      CannotRenameCurrentWorkspaceError
    );
  });

  test("throws when the old workspace is missing", () => {
    expect(() =>
      app.assertCanRename(loc("old"), loc("new"), ctx(), { oldExists: false, newExists: false })
    ).toThrow(WorkspaceNotFoundError);
  });

  test("throws when the new workspace already exists", () => {
    expect(() =>
      app.assertCanRename(loc("old"), loc("new"), ctx(), { oldExists: true, newExists: true })
    ).toThrow(WorkspaceExistsError);
  });

  test("passes when old exists and new does not", () => {
    expect(() => app.assertCanRename(loc("old"), loc("new"), ctx(), facts)).not.toThrow();
  });
});

describe("formatWorkspaceList / selectStaleWorkspaces", () => {
  const entries = [
    { location: loc("feature"), exists: true },
    { location: loc("stale"), exists: false },
  ];

  test("lists default first, then each workspace with markers", () => {
    expect(app.formatWorkspaceList(ctx(), entries)).toEqual([
      "* default (/repo)",
      "  feature (/repo__ws/feature)",
      "  stale ✗",
    ]);
  });

  test("marks the current linked workspace", () => {
    const c = ctx({ currentWorkspaceRoot: "/repo__ws/feature" });
    expect(app.formatWorkspaceList(c, entries)[1]).toBe("* feature (/repo__ws/feature)");
  });

  test("selects names of workspaces whose directory is missing", () => {
    expect(app.selectStaleWorkspaces(entries)).toEqual(["stale"]);
  });
});

describe("assertConfigAbsent", () => {
  test("throws with the path when config exists", () => {
    expect(() => app.assertConfigAbsent("/repo/.jwconfig", true)).toThrow(ConfigAlreadyExistsError);
    expect(() => app.assertConfigAbsent("/repo/.jwconfig", true)).toThrow("/repo/.jwconfig");
    expect(() => app.assertConfigAbsent("/repo/.jwconfig", false)).not.toThrow();
  });
});

describe("resolveThisTarget / requireCurrentChangeId", () => {
  test("returns the current workspace name", () => {
    const c = ctx({ currentWorkspaceRoot: "/repo__ws/feature-x" });
    expect(app.resolveThisTarget(c)).toBe("feature-x");
  });

  test("throws in the default workspace", () => {
    expect(() => app.resolveThisTarget(ctx())).toThrow(
      "Cannot run 'jw this' from default workspace"
    );
  });

  test("requireCurrentChangeId returns the id or throws ValidationError", () => {
    expect(app.requireCurrentChangeId("f", "abc")).toBe("abc");
    expect(() => app.requireCurrentChangeId("feature-x", null)).toThrow(ValidationError);
    expect(() => app.requireCurrentChangeId("feature-x", null)).toThrow(
      'Current workspace "feature-x" not found in jj workspace list'
    );
  });
});

describe("resolveUseTarget / requireChangeId", () => {
  test("throws ValidationError for an empty name", () => {
    expect(() => app.resolveUseTarget(ctx(), "")).toThrow(ValidationError);
  });

  test("throws for the default workspace name", () => {
    expect(() => app.resolveUseTarget(ctx(), "default")).toThrow(
      "Cannot use the default workspace"
    );
  });

  test("throws when not in the default workspace", () => {
    const c = ctx({ currentWorkspaceRoot: "/repo__ws/feature" });
    expect(() => app.resolveUseTarget(c, "feature-x")).toThrow(NotDefaultWorkspaceError);
  });

  test("returns the normalized name", () => {
    expect(app.resolveUseTarget(ctx(), "feat/x")).toBe("feat-x");
  });

  test("requireChangeId returns the id or throws WorkspaceNotFoundError", () => {
    expect(app.requireChangeId("f", "abc")).toBe("abc");
    expect(() => app.requireChangeId("f", null)).toThrow(WorkspaceNotFoundError);
  });
});
