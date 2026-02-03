import { afterEach, beforeEach, describe, expect, mock, test, vi } from "bun:test";
import { DEFAULT_WORKSPACE_NAME } from "../constants.ts";
import { main } from "../index.ts";

const cleanWorkspacesMock = vi.fn();
const copyToWorkspaceMock = vi.fn();
const goWorkspaceMock = vi.fn();
const initWorkspaceMock = vi.fn();
const listWorkspacesMock = vi.fn();
const newWorkspaceMock = vi.fn();
const removeWorkspaceMock = vi.fn();
const renameWorkspaceMock = vi.fn();

mock.module("../workspace.ts", () => ({
  cleanWorkspaces: cleanWorkspacesMock,
  copyToWorkspace: copyToWorkspaceMock,
  goWorkspace: goWorkspaceMock,
  initWorkspace: initWorkspaceMock,
  listWorkspaces: listWorkspacesMock,
  newWorkspace: newWorkspaceMock,
  removeWorkspace: removeWorkspaceMock,
  renameWorkspace: renameWorkspaceMock,
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
  cleanWorkspacesMock.mockResolvedValue(undefined);
  copyToWorkspaceMock.mockResolvedValue(undefined);
  goWorkspaceMock.mockResolvedValue(undefined);
  initWorkspaceMock.mockResolvedValue(undefined);
  listWorkspacesMock.mockResolvedValue(undefined);
  newWorkspaceMock.mockResolvedValue(undefined);
  removeWorkspaceMock.mockResolvedValue(undefined);
  renameWorkspaceMock.mockResolvedValue(undefined);
  exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number) => {
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

    const result = main()

    expect(result).rejects.toThrow("0");
    expect(logSpy.mock.calls[0]?.[0]).toContain("Usage");
  });

  test("runs init command", async () => {
    setArgv(["init"]);

    await main();

    expect(initWorkspaceMock).toHaveBeenCalled();
  });

  test("parses new command with revision", async () => {
    setArgv(["new", "feature", "-r", "abc123"]);

    await main();

    expect(newWorkspaceMock).toHaveBeenCalledWith("feature", "abc123");
  });

  test("lists workspaces", async () => {
    setArgv(["list"]);

    await main();

    expect(listWorkspacesMock).toHaveBeenCalled();
  });

  test("uses default workspace for go", async () => {
    setArgv(["go"]);

    await main();

    expect(goWorkspaceMock).toHaveBeenCalledWith(DEFAULT_WORKSPACE_NAME);
  });

  test("uses provided workspace for go", async () => {
    setArgv(["go", "feature"]);

    await main();

    expect(goWorkspaceMock).toHaveBeenCalledWith("feature");
  });

  test("removes workspace", async () => {
    setArgv(["rm", "old"]);

    await main();

    expect(removeWorkspaceMock).toHaveBeenCalledWith("old");
  });

  test("renames workspace", async () => {
    setArgv(["rename", "old", "new"]);

    await main();

    expect(renameWorkspaceMock).toHaveBeenCalledWith("old", "new");
  });

  test("copies workspace files", async () => {
    setArgv(["copy", "docs"]);

    await main();

    expect(copyToWorkspaceMock).toHaveBeenCalledWith("docs");
  });

  test("cleans workspaces", async () => {
    setArgv(["clean"]);

    await main();

    expect(cleanWorkspacesMock).toHaveBeenCalled();
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

    const result = main()

    expect(result).rejects.toThrow("1");
    expect(errorSpy).toHaveBeenCalledWith(
      "Error: Please specify a workspace name\nUsage: jw rm <name>"
    );
  });

  test("reports unsupported shell", async () => {
    setArgv(["completion", "zsh"]);

    const result = main()

    expect(result).rejects.toThrow("1");
    expect(errorSpy).toHaveBeenCalledWith('Error: Unsupported shell "zsh"\nSupported shells: bash');
  });

  test("reports unknown command", async () => {
    setArgv(["wat"]);

    const result = main()

    expect(result).rejects.toThrow("1");
    expect(errorSpy).toHaveBeenCalledWith('Error: Unknown command "wat"');
  });

  test("reports unexpected errors", async () => {
    listWorkspacesMock.mockRejectedValueOnce(new Error("boom"));
    setArgv(["list"]);

    const result = main()

    expect(result).rejects.toThrow("1");
    expect(errorSpy).toHaveBeenCalledWith("Unexpected error: Error: boom");
  });
});
