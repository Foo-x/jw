import { describe, expect, test } from "bun:test";
import { normalizeWorkspaceName } from "../utils.ts";

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
