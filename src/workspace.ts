import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  addWorkspace as addWorkspaceToConfig,
  loadConfig,
  removeWorkspace as removeWorkspaceFromConfig,
  saveConfig,
} from "./config.ts";
import { DEFAULT_WORKSPACE_NAME } from "./constants.ts";
import { JujutsuCommandError, WorkspaceExistsError, WorkspaceNotFoundError } from "./errors.ts";
import {
  copyFileOrDir,
  execCommand,
  getDefaultWorkspacePath,
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

  await addWorkspaceToConfig(normalizedName);

  console.log(`Created workspace "${normalizedName}": ${workspacePath}`);
}

export async function listWorkspaces(): Promise<void> {
  const config = await loadConfig();
  const defaultPath = getDefaultWorkspacePath();
  const currentPath = getRepoRoot();

  const defaultMark = currentPath === defaultPath ? "*" : " ";
  console.log(`  ${defaultMark} ✓ ${DEFAULT_WORKSPACE_NAME} (${defaultPath})`);

  for (const ws of config.workspaces) {
    const path = getWorkspacePath(ws);
    const exists = existsSync(path) ? "✓" : "✗";
    const mark = currentPath === path ? "*" : " ";
    console.log(`  ${mark} ${exists} ${ws} (${path})`);
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
  const workspacePath = getWorkspacePath(normalizedName);

  console.log(`Removing workspace "${normalizedName}"...`);

  const result = await execCommand("jj", ["workspace", "forget", normalizedName]);

  if (result.exitCode !== 0) {
    console.warn(`Failed to run jj workspace forget: ${result.stderr}`);
  }

  if (existsSync(workspacePath)) {
    await removeDir(workspacePath);
  }

  await removeWorkspaceFromConfig(normalizedName);

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

  // Update config
  await removeWorkspaceFromConfig(normalizedOldName);
  await addWorkspaceToConfig(normalizedNewName);

  console.log(`Renamed workspace "${normalizedOldName}" to "${normalizedNewName}"`);
}

export async function cleanWorkspaces(): Promise<void> {
  const config = await loadConfig();
  const removedWorkspaces: string[] = [];

  for (const ws of config.workspaces) {
    const path = getWorkspacePath(ws);
    if (!existsSync(path)) {
      removedWorkspaces.push(ws);
    }
  }

  if (removedWorkspaces.length === 0) {
    console.log("No workspaces to remove");
    return;
  }

  config.workspaces = config.workspaces.filter((ws) => !removedWorkspaces.includes(ws));

  // Run jj workspace forget for each workspace to be removed
  for (const ws of removedWorkspaces) {
    const result = await execCommand("jj", ["workspace", "forget", ws]);
    if (result.exitCode !== 0) {
      console.warn(`Failed to run jj workspace forget for "${ws}": ${result.stderr.trim()}`);
    }
  }

  await saveConfig(config);

  console.log("Removed workspaces:");
  for (const ws of removedWorkspaces) {
    console.log(`  ${ws}`);
  }
}
