import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_WORKSPACE_NAME } from "../constants.ts";
import { main } from "../index.ts";

const mockCleanWorkspaces = vi.hoisted(() => vi.fn());
const mockCopyToWorkspace = vi.hoisted(() => vi.fn());
const mockGoWorkspace = vi.hoisted(() => vi.fn());
const mockInitWorkspace = vi.hoisted(() => vi.fn());
const mockListWorkspaces = vi.hoisted(() => vi.fn());
const mockNewWorkspace = vi.hoisted(() => vi.fn());
const mockRemoveWorkspace = vi.hoisted(() => vi.fn());
const mockRenameWorkspace = vi.hoisted(() => vi.fn());

vi.mock(import("../workspace.ts"), () => ({
  cleanWorkspaces: mockCleanWorkspaces,
  copyToWorkspace: mockCopyToWorkspace,
  goWorkspace: mockGoWorkspace,
  initWorkspace: mockInitWorkspace,
  listWorkspaces: mockListWorkspaces,
  newWorkspace: mockNewWorkspace,
  removeWorkspace: mockRemoveWorkspace,
  renameWorkspace: mockRenameWorkspace,
}));

const originalArgv = process.argv;

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

const setArgv = (args: string[]) => {
  process.argv = ["bun", "index.ts", ...args];
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCleanWorkspaces.mockResolvedValue(undefined);
  mockCopyToWorkspace.mockResolvedValue(undefined);
  mockGoWorkspace.mockResolvedValue(undefined);
  mockInitWorkspace.mockResolvedValue(undefined);
  mockListWorkspaces.mockResolvedValue(undefined);
  mockNewWorkspace.mockResolvedValue(undefined);
  mockRemoveWorkspace.mockResolvedValue(undefined);
  mockRenameWorkspace.mockResolvedValue(undefined);
  exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
    throw code ?? 0;
  });
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errorSpy.mockRestore();
  process.argv = originalArgv;
});

describe("index CLI", () => {
  test("shows help and exits when no args", async () => {
    setArgv([]);

    const result = main();

    await expect(result).rejects.toBe(0);
    expect(logSpy.mock.calls[0]?.[0]).toContain("Usage");
  });

  test("runs init command", async () => {
    setArgv(["init"]);

    await main();

    expect(mockInitWorkspace).toHaveBeenCalled();
  });

  test("parses new command with revision", async () => {
    setArgv(["new", "feature", "-r", "abc123"]);

    await main();

    expect(mockNewWorkspace).toHaveBeenCalledWith("feature", "abc123");
  });

  test("lists workspaces", async () => {
    setArgv(["list"]);

    await main();

    expect(mockListWorkspaces).toHaveBeenCalled();
  });

  test("uses default workspace for go", async () => {
    setArgv(["go"]);

    await main();

    expect(mockGoWorkspace).toHaveBeenCalledWith(DEFAULT_WORKSPACE_NAME);
  });

  test("uses provided workspace for go", async () => {
    setArgv(["go", "feature"]);

    await main();

    expect(mockGoWorkspace).toHaveBeenCalledWith("feature");
  });

  test("removes workspace", async () => {
    setArgv(["rm", "old"]);

    await main();

    expect(mockRemoveWorkspace).toHaveBeenCalledWith("old");
  });

  test("renames workspace", async () => {
    setArgv(["rename", "old", "new"]);

    await main();

    expect(mockRenameWorkspace).toHaveBeenCalledWith("old", "new");
  });

  test("copies workspace files", async () => {
    setArgv(["copy", "docs"]);

    await main();

    expect(mockCopyToWorkspace).toHaveBeenCalledWith("docs");
  });

  test("cleans workspaces", async () => {
    setArgv(["clean"]);

    await main();

    expect(mockCleanWorkspaces).toHaveBeenCalled();
  });

  test("prints help for help command", async () => {
    setArgv(["help"]);

    await main();

    expect(logSpy.mock.calls[0]?.[0]).toContain("Usage");
  });

  test("prints help for --help", async () => {
    setArgv(["--help"]);

    await main();

    expect(logSpy.mock.calls[0]?.[0]).toContain("Usage");
  });

  test("prints help for -h", async () => {
    setArgv(["-h"]);

    await main();

    expect(logSpy.mock.calls[0]?.[0]).toContain("Usage");
  });

  test("outputs bash completion", async () => {
    setArgv(["completion", "bash"]);

    await main();

    expect(logSpy.mock.calls[0]?.[0]).toContain("_jw_completion()");
  });

  test("reports validation error for missing rm arg", async () => {
    setArgv(["rm"]);

    const result = main();

    await expect(result).rejects.toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "Error: Please specify a workspace name\nUsage: jw rm <name>"
    );
  });

  test("reports unsupported shell", async () => {
    setArgv(["completion", "zsh"]);

    const result = main();

    await expect(result).rejects.toBe(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: Unsupported shell "zsh"\nSupported shells: bash');
  });

  test("reports unknown command", async () => {
    setArgv(["wat"]);

    const result = main();

    await expect(result).rejects.toBe(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: Unknown command "wat"');
  });

  test("reports unexpected errors", async () => {
    mockListWorkspaces.mockRejectedValueOnce(new Error("boom"));
    setArgv(["list"]);

    const result = main();

    await expect(result).rejects.toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("Unexpected error: Error: boom");
  });
});
