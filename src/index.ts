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
  jw new <name>      Create a new workspace
  jw list            List all workspaces
  jw go [name]       Output workspace path (defaults to "default")
  jw rm <name>       Remove a workspace
  jw rename <old> <new>  Rename a workspace
  jw copy <name>     Copy files from default workspace to specified workspace
  jw clean           Remove non-existent workspaces from config
  jw help            Show this help
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
      case "new":
        if (args.length < 2) {
          console.error("Error: Please specify a workspace name");
          console.error("Usage: jw new <name>");
          process.exit(1);
        }
        await newWorkspace(args[1]);
        break;

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
