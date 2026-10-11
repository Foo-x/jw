import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CommandRunner } from "@/controller/ports.ts";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

import { existsSync, statSync } from "node:fs";
import { createNodeFileSystem } from "@/infrastructure/file-system.ts";

const run = vi.fn();
const runner: CommandRunner = { run };
const fs = createNodeFileSystem(runner);

beforeEach(() => {
  vi.resetAllMocks();
  run.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
});

describe("createNodeFileSystem", () => {
  test("exists delegates to existsSync", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(fs.exists("/a")).toBe(true);
    expect(existsSync).toHaveBeenCalledWith("/a");
  });

  test("makeDir runs mkdir -p", async () => {
    await fs.makeDir("/a/b");
    expect(run).toHaveBeenCalledWith("mkdir", ["-p", "/a/b"]);
  });

  test("copy runs cp without -r for a file", async () => {
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false } as ReturnType<
      typeof statSync
    >);
    await fs.copy("/src/file.txt", "/dest");
    expect(statSync).toHaveBeenCalledWith("/src/file.txt");
    expect(run).toHaveBeenCalledWith("cp", ["/src/file.txt", "/dest"]);
  });

  test("copy runs cp -r for a directory", async () => {
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);
    await fs.copy("/src/dir", "/dest");
    expect(run).toHaveBeenCalledWith("cp", ["-r", "/src/dir", "/dest"]);
  });

  test("remove runs rm -rf", async () => {
    await fs.remove("/tmp/ws");
    expect(run).toHaveBeenCalledWith("rm", ["-rf", "/tmp/ws"]);
  });

  test("move runs mv", async () => {
    await fs.move("/a", "/b");
    expect(run).toHaveBeenCalledWith("mv", ["/a", "/b"]);
  });
});
