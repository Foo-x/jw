import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { JujutsuCommandError, NotJujutsuRepositoryError } from "../controller/errors.ts";
import type { CommandRunner, Jujutsu } from "../controller/ports.ts";
import { resolveDefaultWorkspaceFromRepoPointer } from "../domain/workspace.ts";
import { JJ_DIR } from "./constants.ts";

/**
 * Parse the output of `jj workspace list` and return an array of workspace names.
 * Output format: "workspace_name: change_id commit_id ..."
 */
export function parseJjWorkspaceList(output: string): string[] {
  if (!output.trim()) return [];
  return output
    .trim()
    .split("\n")
    .map((line) => {
      const colonIndex = line.indexOf(":");
      return colonIndex > 0 ? line.substring(0, colonIndex).trim() : null;
    })
    .filter((name): name is string => name !== null);
}

/**
 * Extract the change_id for a given workspace from `jj workspace list` output.
 * Output format: "workspace_name: change_id commit_id ..."
 * Returns null if the workspace is not found or the line format is invalid.
 */
export function getChangeIdFromWorkspaceList(output: string, workspaceName: string): string | null {
  if (!output.trim()) return null;

  const lines = output.trim().split("\n");
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) continue;

    const name = line.substring(0, colonIndex).trim();
    if (name !== workspaceName) continue;

    const remainder = line.substring(colonIndex + 1).trim();
    const parts = remainder.split(/\s+/);

    if (parts.length === 0 || !parts[0]) return null;

    return parts[0];
  }

  return null;
}

export function createJujutsuCli(runner: CommandRunner): Jujutsu {
  async function run(operation: string, args: string[], cwd?: string): Promise<string> {
    const result = await runner.run("jj", args, cwd);
    if (result.exitCode !== 0) {
      throw new JujutsuCommandError(operation, result.stderr);
    }
    return result.stdout;
  }

  function getWorkspaceRoot(): string {
    const result = Bun.spawnSync(["jj", "workspace", "root", "--ignore-working-copy"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    if (result.exitCode !== 0) {
      throw new NotJujutsuRepositoryError();
    }

    return result.stdout.toString().trim();
  }

  function getDefaultWorkspacePath(): string {
    const currentWorkspaceRoot = getWorkspaceRoot();
    const repoPath = join(currentWorkspaceRoot, JJ_DIR, "repo");

    if (!existsSync(repoPath)) {
      throw new Error("Could not find .jj/repo");
    }

    // If .jj/repo is a directory, we are in the default workspace
    if (statSync(repoPath).isDirectory()) {
      return currentWorkspaceRoot;
    }

    // If .jj/repo is a file, read it to get the default workspace path
    return resolveDefaultWorkspaceFromRepoPointer(repoPath, readFileSync(repoPath, "utf-8"));
  }

  return {
    getWorkspaceRoot,
    getDefaultWorkspacePath,

    async listWorkspaceNames() {
      return parseJjWorkspaceList(await run("list workspaces", ["workspace", "list"]));
    },

    async findChangeId(name) {
      const output = await run("list workspaces", ["workspace", "list"]);
      return getChangeIdFromWorkspaceList(output, name);
    },

    async addWorkspace(name, path, revision) {
      const args = ["workspace", "add", "--name", name];
      if (revision) {
        args.push("--revision", revision);
      }
      await run("create workspace", [...args, path]);
    },

    async forgetWorkspace(name) {
      await run("forget workspace", ["workspace", "forget", name]);
    },

    async renameWorkspace(newName, cwd) {
      await run("rename workspace", ["workspace", "rename", newName], cwd);
    },

    async edit(changeId, cwd) {
      await run("edit revision", ["edit", changeId], cwd);
    },
  };
}
