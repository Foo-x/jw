#!/usr/bin/env bun

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
`)
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

        if (!name) {
          console.error("Error: Please specify a workspace name");
          console.error("Usage: jw new <name> [-r <revision>]");
          process.exit(1);
        }
        await newWorkspace(name, revision);
        break;
      }

      case "list":
        await listWorkspaces();
        break;

      case "go":
        await goWorkspace(args[1] || "default");
        break;

      case "rm":
        if (args.length < 2) {
          console.error("Error: Please specify a workspace name");
          console.error("Usage: jw rm <name>");
          process.exit(1);
        }
        await removeWorkspace(args[1]);
        break;

      case "rename":
        if (args.length < 3) {
          console.error("Error: Please specify old and new workspace names");
          console.error("Usage: jw rename <old> <new>");
          process.exit(1);
        }
        await renameWorkspace(args[1], args[2]);
        break;

      case "copy":
        if (args.length < 2) {
          console.error("Error: Please specify a workspace name");
          console.error("Usage: jw copy <name>");
          process.exit(1);
        }
        await copyToWorkspace(args[1]);
        break;

      case "clean":
        await cleanWorkspaces();
        break;

      case "completion":
        if (args.length < 2) {
          console.error("Error: Please specify a shell");
          console.error("Usage: jw completion <shell>");
          console.error("Supported shells: bash");
          process.exit(1);
        }
        if (args[1] === "bash") {
          generateBashCompletion();
        } else {
          console.error(`Error: Unsupported shell "${args[1]}"`);
          console.error("Supported shells: bash");
          process.exit(1);
        }
        break;

      case "help":
      case "--help":
      case "-h":
        showHelp();
        break;

      default:
        console.error(`Error: Unknown command "${command}"`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

main();
