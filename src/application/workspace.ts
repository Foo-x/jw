import { join } from "node:path";
import type { Config } from "@/domain/config.ts";
import {
  ConfigAlreadyExistsError,
  ValidationError,
  WorkspaceExistsError,
  WorkspaceNotFoundError,
} from "@/domain/errors.ts";
import {
  assertInDefaultWorkspace,
  assertNotDefaultName,
  assertNotInDefaultWorkspace,
  assertRemovable,
  assertRenamable,
  DEFAULT_WORKSPACE_NAME,
  normalizeWorkspaceName,
  resolveCurrentWorkspaceName,
  resolveWorkspacePath,
  resolveWorkspacesDir,
} from "@/domain/workspace.ts";

export interface Locations {
  defaultWorkspacePath: string;
  currentWorkspaceRoot: string;
}

export interface RepoContext extends Locations {
  config: Config;
}

export interface WorkspaceLocation {
  name: string;
  path: string;
}

export interface WorkspaceEntry {
  location: WorkspaceLocation;
  exists: boolean;
}

export interface CopySource {
  file: string;
  path: string;
}

export interface ShellCommand {
  line: string;
  command: string;
  args: string[];
}

export interface NewWorkspacePlan {
  location: WorkspaceLocation;
  workspacesDir: string;
  copySources: CopySource[];
  postCreateCommands: ShellCommand[];
}

export function formatDefaultWorkspaceLine(defaultPath: string, currentPath: string): string {
  const defaultMark = currentPath === defaultPath ? "*" : " ";
  return `${defaultMark} ${DEFAULT_WORKSPACE_NAME} (${defaultPath})`;
}

export function formatWorkspaceLine(
  name: string,
  workspacePath: string,
  currentPath: string,
  exists: boolean
): string {
  const pathInfo = exists ? `(${workspacePath})` : "✗";
  const mark = currentPath === workspacePath ? "*" : " ";
  return `${mark} ${name} ${pathInfo}`;
}

export function locateWorkspace(ctx: RepoContext, name: string): WorkspaceLocation {
  const normalizedName = normalizeWorkspaceName(name);
  return {
    name: normalizedName,
    path: resolveWorkspacePath(
      ctx.defaultWorkspacePath,
      normalizedName,
      ctx.config.workspacesDirSuffix
    ),
  };
}

/** Keeps the name jj reported, so it can be passed back to jj unchanged. */
export function locateNonDefaultWorkspaces(ctx: RepoContext, names: string[]): WorkspaceLocation[] {
  return names
    .filter((name) => name !== DEFAULT_WORKSPACE_NAME)
    .map((name) => ({ name, path: locateWorkspace(ctx, name).path }));
}

export function planCopy(ctx: RepoContext): CopySource[] {
  return ctx.config.copyFiles.map((file) => ({
    file,
    path: join(ctx.currentWorkspaceRoot, file),
  }));
}

export function planNewWorkspace(ctx: RepoContext, name: string): NewWorkspacePlan {
  return {
    location: locateWorkspace(ctx, name),
    workspacesDir: resolveWorkspacesDir(ctx.defaultWorkspacePath, ctx.config.workspacesDirSuffix),
    copySources: planCopy(ctx),
    postCreateCommands: ctx.config.postCreateCommands.map((line) => {
      const parts = line.split(" ");
      return { line, command: parts[0], args: parts.slice(1) };
    }),
  };
}

export function assertCanCreate(location: WorkspaceLocation, exists: boolean): void {
  if (exists) {
    throw new WorkspaceExistsError(location.name);
  }
}

export function assertWorkspaceExists(location: WorkspaceLocation, exists: boolean): void {
  if (!exists) {
    throw new WorkspaceNotFoundError(location.name);
  }
}

export function assertCanRemove(location: WorkspaceLocation, ctx: Locations): void {
  assertRemovable(location.name, location.path, ctx.currentWorkspaceRoot);
}

export function assertCanRename(
  oldLocation: WorkspaceLocation,
  newLocation: WorkspaceLocation,
  ctx: Locations,
  facts: { oldExists: boolean; newExists: boolean }
): void {
  assertRenamable(oldLocation.name, oldLocation.path, ctx.currentWorkspaceRoot);
  assertWorkspaceExists(oldLocation, facts.oldExists);
  assertCanCreate(newLocation, facts.newExists);
}

export function formatWorkspaceList(ctx: Locations, entries: WorkspaceEntry[]): string[] {
  return [
    formatDefaultWorkspaceLine(ctx.defaultWorkspacePath, ctx.currentWorkspaceRoot),
    ...entries.map(({ location, exists }) =>
      formatWorkspaceLine(location.name, location.path, ctx.currentWorkspaceRoot, exists)
    ),
  ];
}

export function selectStaleWorkspaces(entries: WorkspaceEntry[]): string[] {
  return entries.filter(({ exists }) => !exists).map(({ location }) => location.name);
}

export function assertConfigAbsent(configPath: string, exists: boolean): void {
  if (exists) {
    throw new ConfigAlreadyExistsError(configPath);
  }
}

/** Name of the current workspace, which `jw this` hands over to the default workspace. */
export function resolveThisTarget(ctx: Locations): string {
  const currentWorkspaceName = resolveCurrentWorkspaceName(
    ctx.currentWorkspaceRoot,
    ctx.defaultWorkspacePath
  );
  assertNotInDefaultWorkspace(currentWorkspaceName);
  return currentWorkspaceName;
}

export function requireCurrentChangeId(name: string, changeId: string | null): string {
  if (!changeId) {
    throw new ValidationError(`Current workspace "${name}" not found in jj workspace list`);
  }
  return changeId;
}

export function resolveUseTarget(ctx: Locations, name: string): string {
  if (!name) {
    throw new ValidationError("Please specify a workspace name\nUsage: jw use <name>");
  }

  const normalizedName = normalizeWorkspaceName(name);
  assertNotDefaultName(normalizedName);
  assertInDefaultWorkspace(ctx.currentWorkspaceRoot, ctx.defaultWorkspacePath);
  return normalizedName;
}

export function requireChangeId(name: string, changeId: string | null): string {
  if (!changeId) {
    throw new WorkspaceNotFoundError(name);
  }
  return changeId;
}
