import { describe, expect, test } from "bun:test";
import { parseConfig } from "../config.ts";

describe("parseConfig", () => {
  test("returns default config when data is null", () => {
    const result = parseConfig(null);
    expect(result).toEqual({
      workspaces: [],
      copyFiles: [],
      postCreateCommands: [],
    });
  });

  test("returns default config when data is not an object", () => {
    const result = parseConfig("invalid");
    expect(result).toEqual({
      workspaces: [],
      copyFiles: [],
      postCreateCommands: [],
    });
  });

  test("parses valid config correctly", () => {
    const input = {
      workspaces: ["workspace1", "workspace2"],
      copyFiles: [".env", "config.json"],
      postCreateCommands: ["npm install"],
    };
    const result = parseConfig(input);
    expect(result).toEqual(input);
  });

  test("uses defaults for invalid workspaces", () => {
    const input = {
      workspaces: "invalid",
      copyFiles: [".env"],
      postCreateCommands: [],
    };
    const result = parseConfig(input);
    expect(result.workspaces).toEqual([]);
    expect(result.copyFiles).toEqual([".env"]);
  });

  test("uses defaults for non-string array elements", () => {
    const input = {
      workspaces: ["valid", 123, "another"],
      copyFiles: [],
      postCreateCommands: [],
    };
    const result = parseConfig(input);
    expect(result.workspaces).toEqual([]);
  });

  test("handles missing fields", () => {
    const input = {
      workspaces: ["workspace1"],
    };
    const result = parseConfig(input);
    expect(result.workspaces).toEqual(["workspace1"]);
    expect(result.copyFiles).toEqual([]);
    expect(result.postCreateCommands).toEqual([]);
  });

  test("handles empty object", () => {
    const result = parseConfig({});
    expect(result).toEqual({
      workspaces: [],
      copyFiles: [],
      postCreateCommands: [],
    });
  });
});
