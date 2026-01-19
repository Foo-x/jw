#!/usr/bin/env bun

import { DEFAULT_WORKSPACE_NAME, SUPPORTED_SHELLS } from "./constants.ts";
import { JwError, ValidationError } from "./errors.ts";
import {
  cleanWorkspaces,
  copyToWorkspace,
  goWorkspace,
  listWorkspaces,
  newWorkspace,
  removeWorkspace,
  renameWorkspace,
} from "./workspace.ts";

function showHelp(): void {
  console.log(`
jw - jujutsu workspace management CLI

Usage:
  jw new <name> [-r <revision>]  Create a new workspace
  jw list                        List all workspaces
  jw go [name]                   Output workspace path (defaults to "default")
  jw rm <name>                   Remove a workspace
  jw rename <old> <new>          Rename a workspace
  jw copy <name>                 Copy files from default workspace to specified workspace
  jw clean                       Remove non-existent workspaces from config
  jw completion <shell>          Generate completion script for the specified shell
  jw help                        Show this help
`);
}

function requireArg(
  value: string | undefined,
  argName: string,
  usage: string
): asserts value is string {
  if (!value) {
    throw new ValidationError(`Please specify a ${argName}\nUsage: ${usage}`);
  }
}

function generateBashCompletion(): void {
  console.log(`_jw_completion() {
    local cur prev words cword
    _init_completion || return

    local subcommands="new list go rm rename copy clean completion help"

    # Handle subcommand completion
    if [[ $cword -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$subcommands" -- "$cur"))
        return
    fi

    local subcommand="\${words[1]}"

    case "$subcommand" in
        new)
            if [[ $prev == "-r" || $prev == "--revision" ]]; then
                return
            fi
            COMPREPLY=($(compgen -W "-r --revision" -- "$cur"))
            ;;
        go|rm|copy)
            if [[ $cword -eq 2 ]]; then
                local workspaces
                workspaces=$(jw list 2>/dev/null | command grep -E "^  [* ] [✓✗]" | awk '{if ($1 == "*") print $3; else print $2}')
                COMPREPLY=($(compgen -W "$workspaces" -- "$cur"))
            fi
            ;;
        rename)
            if [[ $cword -eq 2 ]]; then
                local workspaces
                workspaces=$(jw list 2>/dev/null | command grep -E "^  [* ] [✓✗]" | awk '{if ($1 == "*") print $3; else print $2}')
                COMPREPLY=($(compgen -W "$workspaces" -- "$cur"))
            fi
            ;;
        completion)
            if [[ $cword -eq 2 ]]; then
                COMPREPLY=($(compgen -W "bash" -- "$cur"))
            fi
            ;;
        *)
            ;;
    esac
}

complete -F _jw_completion jw
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case "new": {
        let name: string | undefined;
        let revision: string | undefined;

        for (let i = 1; i < args.length; i++) {
          if (args[i] === "-r" || args[i] === "--revision") {
            revision = args[++i];
          } else if (!args[i].startsWith("-")) {
            name = args[i];
          }
        }

        requireArg(name, "workspace name", "jw new <name> [-r <revision>]");
        await newWorkspace(name, revision);
        break;
      }

      case "list":
        await listWorkspaces();
        break;

      case "go":
        await goWorkspace(args[1] || DEFAULT_WORKSPACE_NAME);
        break;

      case "rm":
        requireArg(args[1], "workspace name", "jw rm <name>");
        await removeWorkspace(args[1]);
        break;

      case "rename":
        requireArg(args[1], "old workspace name", "jw rename <old> <new>");
        requireArg(args[2], "new workspace name", "jw rename <old> <new>");
        await renameWorkspace(args[1], args[2]);
        break;

      case "copy":
        requireArg(args[1], "workspace name", "jw copy <name>");
        await copyToWorkspace(args[1]);
        break;

      case "clean":
        await cleanWorkspaces();
        break;

      case "completion":
        requireArg(args[1], "shell", "jw completion <shell>");
        if (SUPPORTED_SHELLS.includes(args[1] as (typeof SUPPORTED_SHELLS)[number])) {
          if (args[1] === "bash") {
            generateBashCompletion();
          }
        } else {
          throw new ValidationError(
            `Unsupported shell "${args[1]}"\nSupported shells: ${SUPPORTED_SHELLS.join(", ")}`
          );
        }
        break;

      case "help":
      case "--help":
      case "-h":
        showHelp();
        break;

      default:
        throw new ValidationError(`Unknown command "${command}"`);
    }
  } catch (error) {
    if (error instanceof JwError) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Unexpected error: ${error}`);
    }
    process.exit(1);
  }
}

main();
