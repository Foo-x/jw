import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { JJ_DIR, WORKSPACES_DIR_SUFFIX } from "./constants.ts";
import { NotJujutsuRepositoryError } from "./errors.ts";

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

export function getRepoName(): string {
  const defaultPath = getDefaultWorkspacePath();
  return basename(defaultPath);
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

export function getWorkspacesDir(): string {
  const defaultPath = getDefaultWorkspacePath();
  const parentDir = dirname(defaultPath);
  const repoName = basename(defaultPath);
  return join(parentDir, `${repoName}${WORKSPACES_DIR_SUFFIX}`);
}

export function getWorkspacePath(name: string): string {
  return join(getWorkspacesDir(), name);
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
