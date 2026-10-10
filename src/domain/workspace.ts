import { basename, dirname, join, resolve } from "node:path";
import {
  CannotRemoveCurrentWorkspaceError,
  CannotRemoveDefaultWorkspaceError,
  CannotRenameCurrentWorkspaceError,
  CannotRenameDefaultWorkspaceError,
  InvalidWorkspaceNameError,
  NotDefaultWorkspaceError,
  ValidationError,
} from "./errors.ts";

export const DEFAULT_WORKSPACE_NAME = "default";
export const WORKSPACES_DIR_SUFFIX = "__ws";

export function normalizeWorkspaceName(name: string): string {
  const normalized = name.replace(/\//g, "-");
  // "." and ".." would resolve outside the workspaces directory (e.g. `jw rm ..` deletes the repo's parent)
  if (normalized === "" || normalized === "." || normalized === "..") {
    throw new InvalidWorkspaceNameError(name);
  }
  return normalized;
}

export function getWorkspacesDirName(repoName: string, suffix: string | undefined): string {
  return `${repoName}${suffix ?? WORKSPACES_DIR_SUFFIX}`;
}

export function resolveWorkspacesDir(defaultWorkspacePath: string, suffix?: string): string {
  return join(
    dirname(defaultWorkspacePath),
    getWorkspacesDirName(basename(defaultWorkspacePath), suffix)
  );
}

export function resolveWorkspacePath(
  defaultWorkspacePath: string,
  name: string,
  suffix?: string
): string {
  return join(resolveWorkspacesDir(defaultWorkspacePath, suffix), name);
}

/**
 * Resolve the default workspace root from the content of a non-default workspace's `.jj/repo` file.
 * The content may be relative to the `.jj` directory.
 */
export function resolveDefaultWorkspaceFromRepoPointer(
  repoFilePath: string,
  pointerContent: string
): string {
  const repoStorePath = resolve(dirname(repoFilePath), pointerContent.trim());
  // Go up two levels (.jj/repo) to get the default workspace root
  return dirname(dirname(repoStorePath));
}

export function resolveCurrentWorkspaceName(
  currentWorkspaceRoot: string,
  defaultWorkspacePath: string
): string {
  if (currentWorkspaceRoot === defaultWorkspacePath) {
    return DEFAULT_WORKSPACE_NAME;
  }
  return basename(currentWorkspaceRoot);
}

export function assertRemovable(
  name: string,
  workspacePath: string,
  currentWorkspaceRoot: string
): void {
  if (name === DEFAULT_WORKSPACE_NAME) {
    throw new CannotRemoveDefaultWorkspaceError();
  }
  if (currentWorkspaceRoot === workspacePath) {
    throw new CannotRemoveCurrentWorkspaceError();
  }
}

export function assertRenamable(
  name: string,
  workspacePath: string,
  currentWorkspaceRoot: string
): void {
  if (name === DEFAULT_WORKSPACE_NAME) {
    throw new CannotRenameDefaultWorkspaceError();
  }
  if (currentWorkspaceRoot === workspacePath) {
    throw new CannotRenameCurrentWorkspaceError();
  }
}

export function assertNotDefaultName(name: string): void {
  if (name === DEFAULT_WORKSPACE_NAME) {
    throw new ValidationError("Cannot use the default workspace");
  }
}

export function assertNotInDefaultWorkspace(currentWorkspaceName: string): void {
  if (currentWorkspaceName === DEFAULT_WORKSPACE_NAME) {
    throw new ValidationError("Cannot run 'jw this' from default workspace");
  }
}

export function assertInDefaultWorkspace(
  currentWorkspaceRoot: string,
  defaultWorkspacePath: string
): void {
  if (currentWorkspaceRoot !== defaultWorkspacePath) {
    throw new NotDefaultWorkspaceError();
  }
}
