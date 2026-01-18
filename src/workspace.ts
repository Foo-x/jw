import { existsSync } from "fs";
import { join } from "path";
import {
  loadConfig,
  saveConfig,
  addWorkspace as addWorkspaceToConfig,
  removeWorkspace as removeWorkspaceFromConfig,
} from "./config.ts";
import {
  execCommand,
  getRepoRoot,
  getDefaultWorkspacePath,
  getWorkspacePath,
  getWorkspacesDir,
  copyFileOrDir,
  removeDir,
  normalizeWorkspaceName,
} from "./utils.ts";

export async function newWorkspace(name: string): Promise<void> {
  const normalizedName = normalizeWorkspaceName(name);
  const workspacePath = getWorkspacePath(normalizedName);

  if (existsSync(workspacePath)) {
    console.error(`Workspace "${normalizedName}" already exists`);
    process.exit(1);
  }

  const workspacesDir = getWorkspacesDir();
  if (!existsSync(workspacesDir)) {
    await execCommand("mkdir", ["-p", workspacesDir]);
  }

  console.log(`Creating workspace "${normalizedName}"...`);

  const result = await execCommand("jj", [
    "workspace",
    "add",
    "--name",
    normalizedName,
    workspacePath,
  ]);

  if (result.exitCode !== 0) {
    console.error(`Failed to create workspace: ${result.stderr}`);
    process.exit(1);
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

  console.log("Workspaces:");
  const defaultMark = currentPath === defaultPath ? "*" : " ";
  console.log(`  ${defaultMark} ✓ default (${defaultPath})`);

  for (const ws of config.workspaces) {
    const path = getWorkspacePath(ws);
    const exists = existsSync(path) ? "✓" : "✗";
    const mark = currentPath === path ? "*" : " ";
    console.log(`  ${mark} ${exists} ${ws} (${path})`);
  }
}

export async function goWorkspace(name: string): Promise<void> {
  if (name === "default") {
    console.log(getDefaultWorkspacePath());
    return;
  }

  const normalizedName = normalizeWorkspaceName(name);
  const workspacePath = getWorkspacePath(normalizedName);

  if (!existsSync(workspacePath)) {
    console.error(`Workspace "${normalizedName}" not found`);
    process.exit(1);
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
    console.error(`Workspace "${normalizedName}" not found`);
    process.exit(1);
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

  config.workspaces = config.workspaces.filter(
    (ws) => !removedWorkspaces.includes(ws)
  );

  await saveConfig(config);

  console.log("Removed workspaces:");
  for (const ws of removedWorkspaces) {
    console.log(`  ${ws}`);
  }
}
