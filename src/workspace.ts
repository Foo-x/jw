import { existsSync } from "node:fs";
import { join } from "node:path";
import { getConfigPath, initConfig, loadConfig } from "./config.ts";
import { DEFAULT_WORKSPACE_NAME } from "./constants.ts";
import {
  CannotRemoveDefaultWorkspaceError,
  JujutsuCommandError,
  WorkspaceExistsError,
  WorkspaceNotFoundError,
} from "./errors.ts";
import {
  copyFileOrDir,
  execCommand,
  getDefaultWorkspacePath,
  getJjWorkspaceList,
  getRepoRoot,
  getWorkspacePath,
  getWorkspacesDir,
  normalizeWorkspaceName,
  removeDir,
} from "./utils.ts";

export async function newWorkspace(name: string, revision?: string): Promise<void> {
  const normalizedName = normalizeWorkspaceName(name);
  const workspacePath = getWorkspacePath(normalizedName);

  if (existsSync(workspacePath)) {
    throw new WorkspaceExistsError(normalizedName);
  }

  const workspacesDir = getWorkspacesDir();
  if (!existsSync(workspacesDir)) {
    await execCommand("mkdir", ["-p", workspacesDir]);
  }

  console.log(`Creating workspace "${normalizedName}"...`);

  const jjArgs = ["workspace", "add", "--name", normalizedName];

  if (revision) {
    jjArgs.push("--revision", revision);
  }

  jjArgs.push(workspacePath);

  const result = await execCommand("jj", jjArgs);

  if (result.exitCode !== 0) {
    throw new JujutsuCommandError("create workspace", result.stderr);
  }

  const config = await loadConfig();
  const repoRoot = getRepoRoot();

  for (const file of config.copyFiles) {
    const srcPath = join(repoRoot, file);
    console.log(`Copying "${file}"...`);
    await copyFileOrDir(srcPath, workspacePath);
  }

  for (const command of config.postCreateCommands) {
    console.log(`Running command: ${command}`);
    const cmdParts = command.split(" ");
    const cmdResult = await execCommand(cmdParts[0], cmdParts.slice(1), workspacePath);

    if (cmdResult.exitCode !== 0) {
      console.warn(`Command failed: ${command}`);
      console.warn(cmdResult.stderr);
    }
  }

  console.log(`Created workspace "${normalizedName}": ${workspacePath}`);
}

export async function listWorkspaces(): Promise<void> {
  const jjWorkspaces = await getJjWorkspaceList();
  const defaultPath = getDefaultWorkspacePath();
  const currentPath = getRepoRoot();

  const otherWorkspaces = jjWorkspaces.filter((ws) => ws !== DEFAULT_WORKSPACE_NAME);

  const defaultMark = currentPath === defaultPath ? "*" : " ";
  console.log(`${defaultMark} ${DEFAULT_WORKSPACE_NAME} (${defaultPath})`);

  for (const ws of otherWorkspaces) {
    const path = getWorkspacePath(ws);
    const exists = existsSync(path);
    const pathInfo = exists ? `(${path})` : "✗";
    const mark = currentPath === path ? "*" : " ";
    console.log(`${mark} ${ws} ${pathInfo}`);
  }
}

export async function goWorkspace(name: string): Promise<void> {
  if (name === DEFAULT_WORKSPACE_NAME) {
    console.log(getDefaultWorkspacePath());
    return;
  }

  const normalizedName = normalizeWorkspaceName(name);
  const workspacePath = getWorkspacePath(normalizedName);

  if (!existsSync(workspacePath)) {
    throw new WorkspaceNotFoundError(normalizedName);
  }

  console.log(workspacePath);
}

export async function removeWorkspace(name: string): Promise<void> {
  const normalizedName = normalizeWorkspaceName(name);

  // デフォルトワークスペースの削除を禁止
  if (normalizedName === DEFAULT_WORKSPACE_NAME) {
    throw new CannotRemoveDefaultWorkspaceError();
  }

  const workspacePath = getWorkspacePath(normalizedName);

  console.log(`Removing workspace "${normalizedName}"...`);

  const result = await execCommand("jj", ["workspace", "forget", normalizedName]);

  if (result.exitCode !== 0) {
    console.warn(`Failed to run jj workspace forget: ${result.stderr}`);
  }

  if (existsSync(workspacePath)) {
    await removeDir(workspacePath);
  }

  console.log(`Removed workspace "${normalizedName}"`);
}

export async function copyToWorkspace(name: string): Promise<void> {
  const normalizedName = normalizeWorkspaceName(name);
  const workspacePath = getWorkspacePath(normalizedName);

  if (!existsSync(workspacePath)) {
    throw new WorkspaceNotFoundError(normalizedName);
  }

  const config = await loadConfig();
  const repoRoot = getRepoRoot();

  console.log(`Copying files to workspace "${normalizedName}"...`);

  for (const file of config.copyFiles) {
    const srcPath = join(repoRoot, file);
    console.log(`  Copying "${file}"...`);
    await copyFileOrDir(srcPath, workspacePath);
  }

  console.log("Copy completed");
}

export async function renameWorkspace(oldName: string, newName: string): Promise<void> {
  const normalizedOldName = normalizeWorkspaceName(oldName);
  const normalizedNewName = normalizeWorkspaceName(newName);
  const oldPath = getWorkspacePath(normalizedOldName);
  const newPath = getWorkspacePath(normalizedNewName);

  if (!existsSync(oldPath)) {
    throw new WorkspaceNotFoundError(normalizedOldName);
  }

  if (existsSync(newPath)) {
    throw new WorkspaceExistsError(normalizedNewName);
  }

  console.log(`Renaming workspace "${normalizedOldName}" to "${normalizedNewName}"...`);

  // Rename workspace in jj (run from the target workspace directory)
  const renameResult = await execCommand("jj", ["workspace", "rename", normalizedNewName], oldPath);

  if (renameResult.exitCode !== 0) {
    throw new JujutsuCommandError("rename workspace", renameResult.stderr);
  }

  // Rename directory
  await execCommand("mv", [oldPath, newPath]);

  console.log(`Renamed workspace "${normalizedOldName}" to "${normalizedNewName}"`);
}

export async function cleanWorkspaces(): Promise<void> {
  const workspaces = await getJjWorkspaceList();
  const forgottenWorkspaces: string[] = [];

  for (const ws of workspaces) {
    if (ws === DEFAULT_WORKSPACE_NAME) continue;

    const path = getWorkspacePath(ws);
    if (!existsSync(path)) {
      const result = await execCommand("jj", ["workspace", "forget", ws]);
      if (result.exitCode === 0) {
        forgottenWorkspaces.push(ws);
      } else {
        console.warn(`Failed to forget workspace "${ws}": ${result.stderr.trim()}`);
      }
    }
  }

  if (forgottenWorkspaces.length === 0) {
    console.log("No stale workspaces found");
    return;
  }

  console.log("Forgotten workspaces:");
  for (const ws of forgottenWorkspaces) {
    console.log(`  ${ws}`);
  }
}

export async function initWorkspace(): Promise<void> {
  // getRepoRoot() will throw NotJujutsuRepositoryError if not in a jj repo
  getRepoRoot();

  // initConfig() will throw ConfigAlreadyExistsError if config already exists
  await initConfig();

  const configPath = getConfigPath();
  console.log(`Initialized jw config: ${configPath}`);
}
