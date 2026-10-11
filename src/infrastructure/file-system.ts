import { existsSync, statSync } from "node:fs";
import type { CommandRunner, FileSystem } from "../controller/ports.ts";

export function createNodeFileSystem(runner: CommandRunner): FileSystem {
  return {
    exists: existsSync,
    async makeDir(path) {
      await runner.run("mkdir", ["-p", path]);
    },
    async copy(src, destDir) {
      const args = statSync(src).isDirectory() ? ["-r", src, destDir] : [src, destDir];
      await runner.run("cp", args);
    },
    async remove(path) {
      await runner.run("rm", ["-rf", path]);
    },
    async move(src, dest) {
      await runner.run("mv", [src, dest]);
    },
  };
}
