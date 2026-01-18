import { existsSync, statSync } from "fs";
import { basename, dirname, resolve, join } from "path";

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
    if (existsSync(join(currentDir, ".jj"))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  throw new Error("Could not find jujutsu repository root");
}

export function getRepoName(): string {
  const repoRoot = getRepoRoot();
  return basename(repoRoot);
}

export function getWorkspacesDir(): string {
  const repoRoot = getRepoRoot();
  const parentDir = dirname(repoRoot);
  const repoName = getRepoName();
  return join(parentDir, `${repoName}-workspaces`);
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
