import type { Config } from "@/domain/config.ts";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandRunner {
  run(command: string, args: string[], cwd?: string): Promise<CommandResult>;
}

/** Every failing operation throws JujutsuCommandError. */
export interface Jujutsu {
  /** Throws NotJujutsuRepositoryError outside a jj repository. */
  getWorkspaceRoot(): string;
  getDefaultWorkspacePath(): string;
  listWorkspaceNames(): Promise<string[]>;
  findChangeId(name: string): Promise<string | null>;
  addWorkspace(name: string, path: string, revision?: string): Promise<void>;
  forgetWorkspace(name: string): Promise<void>;
  renameWorkspace(newName: string, cwd: string): Promise<void>;
  edit(changeId: string, cwd: string): Promise<void>;
}

export interface FileSystem {
  exists(path: string): boolean;
  makeDir(path: string): Promise<void>;
  copy(src: string, destDir: string): Promise<void>;
  remove(path: string): Promise<void>;
  move(src: string, dest: string): Promise<void>;
}

export interface ConfigRepository {
  path(): string;
  exists(): boolean;
  load(): Promise<Config>;
  save(config: Config): Promise<void>;
}

export interface Deps {
  jj: Jujutsu;
  fs: FileSystem;
  runner: CommandRunner;
  config: ConfigRepository;
}
