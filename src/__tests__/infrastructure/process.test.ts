import { beforeEach, describe, expect, test, vi } from "vitest";
import { createProcessRunner } from "../../infrastructure/process.ts";

function mockSpawn(stdout: string, stderr: string, exitCode: number) {
  const stream = (text: string) =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
  globalThis.Bun = {
    ...globalThis.Bun,
    spawn: vi.fn().mockReturnValue({
      stdout: stream(stdout),
      stderr: stream(stderr),
      exited: Promise.resolve(exitCode),
    }),
  };
}

describe("createProcessRunner", () => {
  const runner = createProcessRunner();

  beforeEach(() => {
    mockSpawn("", "", 0);
  });

  test("returns stdout, stderr and exit code", async () => {
    mockSpawn("out\n", "err\n", 42);
    expect(await runner.run("cmd", [])).toEqual({ stdout: "out\n", stderr: "err\n", exitCode: 42 });
  });

  test("passes command and args to Bun.spawn", async () => {
    await runner.run("git", ["status", "--short"]);
    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["git", "status", "--short"],
      expect.objectContaining({ stdout: "pipe", stderr: "pipe" })
    );
  });

  test("uses provided cwd", async () => {
    await runner.run("ls", [], "/tmp");
    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["ls"],
      expect.objectContaining({ cwd: "/tmp" })
    );
  });

  test("falls back to process.cwd() when cwd is not provided", async () => {
    await runner.run("pwd", []);
    expect(globalThis.Bun.spawn).toHaveBeenCalledWith(
      ["pwd"],
      expect.objectContaining({ cwd: process.cwd() })
    );
  });
});
