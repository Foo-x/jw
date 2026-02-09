import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { DEFAULT_WORKSPACE_NAME, JJ_DIR, WORKSPACES_DIR_SUFFIX } from "./constants.ts";
import {
  JujutsuCommandError,
  NotJujutsuRepositoryError,
  WorkspaceNotFoundError,
} from "./errors.ts";

export async function execCommand(
  command: string,
  args: string[],
  cwd?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn([command, ...args], {
    cwd: cwd || process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

export function getRepoRoot(): string {
  let currentDir = process.cwd();

  while (currentDir !== "/") {
    if (existsSync(join(currentDir, JJ_DIR))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  throw new NotJujutsuRepositoryError();
}

export function getDefaultWorkspacePath(): string {
  const currentWorkspaceRoot = getRepoRoot();
  const repoPath = join(currentWorkspaceRoot, JJ_DIR, "repo");

  if (!existsSync(repoPath)) {
    throw new Error("Could not find .jj/repo");
  }

  const stat = statSync(repoPath);

  // If .jj/repo is a directory, we are in the default workspace
  if (stat.isDirectory()) {
    return currentWorkspaceRoot;
  }

  // If .jj/repo is a file, read it to get the default workspace path
  const repoStorePathContent = readFileSync(repoPath, "utf-8").trim();
  // .jj/repo contains path to .jj/repo/store
  // Go up two levels to get the default workspace root
  return dirname(dirname(repoStorePathContent));
}

export function getWorkspacesDirName(repoName: string, suffix: string | undefined): string {
  return `${repoName}${suffix ?? WORKSPACES_DIR_SUFFIX}`;
}

export function getWorkspacesDir(configSuffix?: string): string {
  const defaultPath = getDefaultWorkspacePath();
  const parentDir = dirname(defaultPath);
  const repoName = basename(defaultPath);
  return join(parentDir, getWorkspacesDirName(repoName, configSuffix));
}

export function getWorkspacePath(name: string, configSuffix?: string): string {
  return join(getWorkspacesDir(configSuffix), name);
}

export async function copyFileOrDir(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) {
    console.warn(`Source does not exist: ${src}`);
    return;
  }

  const stat = statSync(src);

  if (stat.isDirectory()) {
    await execCommand("cp", ["-r", src, dest]);
  } else {
    await execCommand("cp", [src, dest]);
  }
}

export async function removeDir(path: string): Promise<void> {
  if (existsSync(path)) {
    await execCommand("rm", ["-rf", path]);
  }
}

export function normalizeWorkspaceName(name: string): string {
  return name.replace(/\//g, "-");
}

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
 * Execute `jj workspace list` and return an array of workspace names.
 */
export async function getJjWorkspaceList(): Promise<string[]> {
  const result = await execCommand("jj", ["workspace", "list"]);
  if (result.exitCode !== 0) {
    throw new JujutsuCommandError("list workspaces", result.stderr);
  }
  return parseJjWorkspaceList(result.stdout);
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

/**
 * Get the name of the current workspace.
 * Returns "default" if in the default workspace, otherwise returns the workspace name.
 */
export function getCurrentWorkspaceName(): string {
  const currentWorkspaceRoot = getRepoRoot();
  const defaultWorkspacePath = getDefaultWorkspacePath();

  if (currentWorkspaceRoot === defaultWorkspacePath) {
    return DEFAULT_WORKSPACE_NAME;
  }

  return basename(currentWorkspaceRoot);
}

/**
 * Get the change_id for a given workspace by executing `jj workspace list`.
 * Throws WorkspaceNotFoundError if the workspace is not found.
 * Throws JujutsuCommandError if `jj workspace list` fails.
 */
export async function getJjWorkspaceChangeId(workspaceName: string): Promise<string> {
  const result = await execCommand("jj", ["workspace", "list"]);
  if (result.exitCode !== 0) {
    throw new JujutsuCommandError("list workspaces", result.stderr);
  }

  const changeId = getChangeIdFromWorkspaceList(result.stdout, workspaceName);
  if (!changeId) {
    throw new WorkspaceNotFoundError(workspaceName);
  }

  return changeId;
}
