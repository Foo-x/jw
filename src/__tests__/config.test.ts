import { describe, expect, test } from "bun:test";
import { parseConfig } from "../config.ts";

describe("parseConfig", () => {
  test("returns default config when data is null", () => {
    const result = parseConfig(null);
    expect(result).toEqual({
      copyFiles: [],
      postCreateCommands: [],
    });
  });

  test("returns default config when data is not an object", () => {
    const result = parseConfig("invalid");
    expect(result).toEqual({
      copyFiles: [],
      postCreateCommands: [],
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
