import { describe, expect, test } from "vitest";
import {
  CannotRemoveCurrentWorkspaceError,
  CannotRemoveDefaultWorkspaceError,
  CannotRenameCurrentWorkspaceError,
  CannotRenameDefaultWorkspaceError,
  InvalidWorkspaceNameError,
  NotDefaultWorkspaceError,
  ValidationError,
} from "../../domain/errors.ts";
import {
  assertInDefaultWorkspace,
  assertNotDefaultName,
  assertNotInDefaultWorkspace,
  assertRemovable,
  assertRenamable,
  getWorkspacesDirName,
  normalizeWorkspaceName,
  resolveCurrentWorkspaceName,
  resolveDefaultWorkspaceFromRepoPointer,
  resolveWorkspacePath,
  resolveWorkspacesDir,
} from "../../domain/workspace.ts";

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

  test("throws on empty string", () => {
    expect(() => normalizeWorkspaceName("")).toThrow(InvalidWorkspaceNameError);
  });

  test("throws on . and ..", () => {
    expect(() => normalizeWorkspaceName(".")).toThrow(InvalidWorkspaceNameError);
    expect(() => normalizeWorkspaceName("..")).toThrow(InvalidWorkspaceNameError);
  });

  test("allows names that merely contain dots", () => {
    expect(normalizeWorkspaceName("a/..")).toBe("a-..");
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

describe("resolveWorkspacesDir", () => {
  test("places the directory next to the default workspace with the default suffix", () => {
    expect(resolveWorkspacesDir("/home/user/my-repo")).toBe("/home/user/my-repo__ws");
  });

  test("uses custom suffix", () => {
    expect(resolveWorkspacesDir("/home/user/my-repo", "-ws")).toBe("/home/user/my-repo-ws");
  });
});

describe("resolveWorkspacePath", () => {
  test("joins the workspace name under the workspaces directory", () => {
    expect(resolveWorkspacePath("/home/user/my-repo", "feature")).toBe(
      "/home/user/my-repo__ws/feature"
    );
  });

  test("uses custom suffix", () => {
    expect(resolveWorkspacePath("/home/user/my-repo", "feature", "-ws")).toBe(
      "/home/user/my-repo-ws/feature"
    );
  });
});

describe("resolveDefaultWorkspaceFromRepoPointer", () => {
  test("resolves a relative pointer from the .jj directory", () => {
    expect(
      resolveDefaultWorkspaceFromRepoPointer(
        "/home/user/my-repo__ws/feature/.jj/repo",
        "../../../my-repo/.jj/repo\n"
      )
    ).toBe("/home/user/my-repo");
  });

  test("resolves an absolute pointer", () => {
    expect(
      resolveDefaultWorkspaceFromRepoPointer(
        "/home/user/my-repo__ws/feature/.jj/repo",
        "/home/user/my-repo/.jj/repo"
      )
    ).toBe("/home/user/my-repo");
  });
});

describe("resolveCurrentWorkspaceName", () => {
  test("returns default when current root is the default workspace", () => {
    expect(resolveCurrentWorkspaceName("/home/user/my-repo", "/home/user/my-repo")).toBe("default");
  });

  test("returns the directory name for other workspaces", () => {
    expect(
      resolveCurrentWorkspaceName("/home/user/my-repo__ws/feature", "/home/user/my-repo")
    ).toBe("feature");
  });
});

describe("assertRemovable", () => {
  test("throws for the default workspace", () => {
    expect(() => assertRemovable("default", "/ws/default", "/other")).toThrow(
      CannotRemoveDefaultWorkspaceError
    );
  });

  test("throws for the current workspace", () => {
    expect(() => assertRemovable("feature", "/ws/feature", "/ws/feature")).toThrow(
      CannotRemoveCurrentWorkspaceError
    );
  });

  test("passes otherwise", () => {
    expect(() => assertRemovable("feature", "/ws/feature", "/repo")).not.toThrow();
  });
});

describe("assertRenamable", () => {
  test("throws for the default workspace", () => {
    expect(() => assertRenamable("default", "/ws/default", "/other")).toThrow(
      CannotRenameDefaultWorkspaceError
    );
  });

  test("throws for the current workspace", () => {
    expect(() => assertRenamable("feature", "/ws/feature", "/ws/feature")).toThrow(
      CannotRenameCurrentWorkspaceError
    );
  });

  test("passes otherwise", () => {
    expect(() => assertRenamable("feature", "/ws/feature", "/repo")).not.toThrow();
  });
});

describe("assertNotDefaultName", () => {
  test("throws for default", () => {
    expect(() => assertNotDefaultName("default")).toThrow(ValidationError);
  });

  test("passes for other names", () => {
    expect(() => assertNotDefaultName("feature")).not.toThrow();
  });
});

describe("assertNotInDefaultWorkspace", () => {
  test("throws when current workspace is default", () => {
    expect(() => assertNotInDefaultWorkspace("default")).toThrow(ValidationError);
  });

  test("passes for other workspaces", () => {
    expect(() => assertNotInDefaultWorkspace("feature")).not.toThrow();
  });
});

describe("assertInDefaultWorkspace", () => {
  test("throws when current root differs from the default workspace", () => {
    expect(() => assertInDefaultWorkspace("/ws/feature", "/repo")).toThrow(
      NotDefaultWorkspaceError
    );
  });

  test("passes when current root is the default workspace", () => {
    expect(() => assertInDefaultWorkspace("/repo", "/repo")).not.toThrow();
  });
});
