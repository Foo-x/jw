import type { CommandRunner } from "@/controller/ports.ts";

export function createProcessRunner(): CommandRunner {
  return {
    async run(command, args, cwd) {
      const proc = Bun.spawn([command, ...args], {
        cwd: cwd || process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      return { stdout, stderr, exitCode };
    },
  };
}
