import {
  assertCanCreate,
  assertCanRemove,
  assertCanRename,
  assertConfigAbsent,
  assertWorkspaceExists,
  type CopySource,
  formatWorkspaceList,
  locateNonDefaultWorkspaces,
  locateWorkspace,
  planCopy,
  planNewWorkspace,
  type RepoContext,
  requireChangeId,
  requireCurrentChangeId,
  resolveThisTarget,
  resolveUseTarget,
  type ShellCommand,
  selectStaleWorkspaces,
  type WorkspaceEntry,
  type WorkspaceLocation,
} from "../application/workspace.ts";
import { getDefaultConfig } from "../domain/config.ts";
import { DEFAULT_WORKSPACE_NAME } from "../domain/workspace.ts";
import { JujutsuCommandError } from "./errors.ts";
import type { Deps } from "./ports.ts";

function readLocations(deps: Deps) {
  return {
    defaultWorkspacePath: deps.jj.getDefaultWorkspacePath(),
    currentWorkspaceRoot: deps.jj.getWorkspaceRoot(),
  };
}

async function readContext(deps: Deps): Promise<RepoContext> {
  return { ...readLocations(deps), config: await deps.config.load() };
}

function readEntries(deps: Deps, locations: WorkspaceLocation[]): WorkspaceEntry[] {
  return locations.map((location) => ({ location, exists: deps.fs.exists(location.path) }));
}

async function copyFiles(deps: Deps, sources: CopySource[], workspacePath: string): Promise<void> {
  for (const { file, path } of sources) {
    console.log(`Copying "${file}"...`);
    if (!deps.fs.exists(path)) {
      console.warn(`Source does not exist: ${path}`);
      continue;
    }
    await deps.fs.copy(path, workspacePath);
  }
}

async function runPostCreateCommands(
  deps: Deps,
  commands: ShellCommand[],
  workspacePath: string
): Promise<void> {
  for (const { line, command, args } of commands) {
    console.log(`Running command: ${line}`);
    const result = await deps.runner.run(command, args, workspacePath);

    if (result.exitCode !== 0) {
      console.warn(`Command failed: ${line}`);
      console.warn(result.stderr);
    }
  }
}

export async function newWorkspace(deps: Deps, name: string, revision?: string): Promise<void> {
  const ctx = await readContext(deps);
  const { location, workspacesDir, copySources, postCreateCommands } = planNewWorkspace(ctx, name);

  assertCanCreate(location, deps.fs.exists(location.path));

  await deps.fs.makeDir(workspacesDir);

  console.log(`Creating workspace "${location.name}"...`);

  await deps.jj.addWorkspace(location.name, location.path, revision);

  await copyFiles(deps, copySources, location.path);

  await runPostCreateCommands(deps, postCreateCommands, location.path);

  console.log(`Created workspace "${location.name}": ${location.path}`);
}

export async function listWorkspaces(deps: Deps): Promise<void> {
  const names = await deps.jj.listWorkspaceNames();
  const ctx = await readContext(deps);

  const entries = readEntries(deps, locateNonDefaultWorkspaces(ctx, names));

  for (const line of formatWorkspaceList(ctx, entries)) {
    console.log(line);
  }
}

export async function goWorkspace(deps: Deps, name: string): Promise<void> {
  if (name === DEFAULT_WORKSPACE_NAME) {
    console.log(deps.jj.getDefaultWorkspacePath());
    return;
  }

  const location = locateWorkspace(await readContext(deps), name);

  assertWorkspaceExists(location, deps.fs.exists(location.path));

  console.log(location.path);
}

export async function removeWorkspace(deps: Deps, name: string): Promise<void> {
  const ctx = await readContext(deps);
  const location = locateWorkspace(ctx, name);

  assertCanRemove(location, ctx);

  console.log(`Removing workspace "${location.name}"...`);

  // Without a successful forget the directory may not be a workspace, so keep it
  await deps.jj.forgetWorkspace(location.name);

  await deps.fs.remove(location.path);

  console.log(`Removed workspace "${location.name}"`);
}

export async function copyToWorkspace(deps: Deps, name: string): Promise<void> {
  const ctx = await readContext(deps);
  const location = locateWorkspace(ctx, name);

  assertWorkspaceExists(location, deps.fs.exists(location.path));

  console.log(`Copying files to workspace "${location.name}"...`);

  await copyFiles(deps, planCopy(ctx), location.path);

  console.log("Copy completed");
}

export async function renameWorkspace(deps: Deps, oldName: string, newName: string): Promise<void> {
  const ctx = await readContext(deps);
  const oldLocation = locateWorkspace(ctx, oldName);
  const newLocation = locateWorkspace(ctx, newName);

  assertCanRename(oldLocation, newLocation, ctx, {
    oldExists: deps.fs.exists(oldLocation.path),
    newExists: deps.fs.exists(newLocation.path),
  });

  console.log(`Renaming workspace "${oldLocation.name}" to "${newLocation.name}"...`);

  // Rename workspace in jj (run from the target workspace directory)
  await deps.jj.renameWorkspace(newLocation.name, oldLocation.path);

  await deps.fs.move(oldLocation.path, newLocation.path);

  console.log(`Renamed workspace "${oldLocation.name}" to "${newLocation.name}"`);
}

export async function cleanWorkspaces(deps: Deps): Promise<void> {
  const names = await deps.jj.listWorkspaceNames();
  const ctx = await readContext(deps);

  const stale = selectStaleWorkspaces(readEntries(deps, locateNonDefaultWorkspaces(ctx, names)));
  const forgottenWorkspaces: string[] = [];

  for (const ws of stale) {
    try {
      await deps.jj.forgetWorkspace(ws);
      forgottenWorkspaces.push(ws);
    } catch (error) {
      if (!(error instanceof JujutsuCommandError)) throw error;
      console.warn(`Failed to forget workspace "${ws}": ${error.stderr.trim()}`);
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

export async function initWorkspace(deps: Deps): Promise<void> {
  // Throws NotJujutsuRepositoryError if not in a jj repo
  deps.jj.getWorkspaceRoot();

  const configPath = deps.config.path();
  assertConfigAbsent(configPath, deps.config.exists());

  await deps.config.save(getDefaultConfig());

  console.log(`Initialized jw config: ${configPath}`);
}

export async function thisWorkspace(deps: Deps): Promise<void> {
  const locations = readLocations(deps);
  const name = resolveThisTarget(locations);

  const changeId = requireCurrentChangeId(name, await deps.jj.findChangeId(name));

  await deps.jj.edit(changeId, locations.defaultWorkspacePath);

  console.log(`Switched default workspace to "${name}" (${changeId})`);
}

export async function useWorkspace(deps: Deps, name: string): Promise<void> {
  const locations = readLocations(deps);
  const targetName = resolveUseTarget(locations, name);

  const changeId = requireChangeId(targetName, await deps.jj.findChangeId(targetName));

  await deps.jj.edit(changeId, locations.defaultWorkspacePath);

  console.log(`Switched default workspace to "${targetName}" (${changeId})`);
}
