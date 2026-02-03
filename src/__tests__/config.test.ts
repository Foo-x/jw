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
