import { describe, expect, test } from "bun:test";
import { getWorkspacesDirName, normalizeWorkspaceName, parseJjWorkspaceList } from "../utils.ts";

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
    expect(getWorkspacesDirName("my-repo", undefined)).toBe("my-repo-workspaces");
  });

  test("uses provided suffix with underscore", () => {
    expect(getWorkspacesDirName("my-repo", "_workspaces")).toBe("my-repo_workspaces");
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
