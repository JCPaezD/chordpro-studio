# Stitch MCP

Repo-local MCP server for exploring and iterating on Stitch projects from Codex using the official `@google/stitch-sdk`.

## Requirements

- `STITCH_API_KEY` must be available in the environment.
- Node.js 18+.
- Codex project trust enabled for this repo if you want automatic repo-local MCP loading.

## Run

From the repo root:

```bash
npm run mcp:stitch
```

From this package:

```bash
npm run start --workspace tools/stitch-mcp
```

## Codex integration

This repo now includes a project-scoped Codex MCP config at [`.codex/config.toml`](../../.codex/config.toml).

When this repository is opened as a trusted project in Codex, the `stitch` MCP server should be available automatically from the repo-local config without editing your global `~/.codex/config.toml`.

If the server does not appear immediately after adding the config, reopen the project or restart Codex so it reloads the repo-local MCP definitions.

The server is still launched through the repo-local batch wrapper, but on the current Windows Codex host we use an absolute `cwd` plus an absolute script path in `.codex/config.toml` because relative `cwd = "."` and relative script args proved unreliable for MCP startup in real Codex sessions. The effective shape is:

```toml
[mcp_servers.stitch]
command = "cmd.exe"
args = [
  "/d",
  "/s",
  "/c",
  "F:\\...\\chordpro-studio\\tools\\stitch-mcp\\scripts\\start-server.cmd",
]
cwd = "F:\\...\\chordpro-studio"
env_vars = [
  "STITCH_API_KEY",
  "PATH",
  "SystemRoot",
  "ComSpec",
  "LOCALAPPDATA",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "NVM_HOME",
  "NVM_SYMLINK",
]
```

The launcher:

- resolves the repo root relative to its own file location
- discovers `node.exe` through `PATH`, `NVM_SYMLINK`, the common `C:\nvm4w\nodejs\node.exe` symlink, or standard Windows install paths
- seeds `STITCH_API_KEY` from the Windows user environment via `HKCU\Environment` when the current Codex session did not inherit it
- starts the MCP server from the repo path once Codex has reached the batch wrapper

Operational caveat for this runtime:

- the wrapper itself is repo-local, but the surrounding Codex MCP config currently needs absolute `cwd` and script path values on Windows for reliable startup
- the failure mode for relative paths was `connection closed: initialize response`, caused by the host launching the stdio server without a repo-root working directory

## What To Use It For

Use this MCP when you want Stitch to help with:

- design-system inspection and iteration
- project and screen discovery
- exploratory screen generation from prompts
- screen edits and variants during UI redesign work
- applying a design system across selected screens

Do not treat Stitch output as final implementation. The intended workflow is to explore visually in Stitch, extract the parts that improve the product, and then integrate them deliberately in the app UI.

## Example prompts

- "List my Stitch projects and show me the design system for the music landing project."
- "Generate three desktop directions for a cleaner ChordPro Studio songbook landing."
- "Create variants of this screen focusing on layout and typography only."
- "Apply the project design system to these selected source screens."

## Current scope

The current implementation pass covers:

- listing projects and screens
- reading screen details
- reading design systems
- exporting screen HTML and screenshot context
- creating projects
- creating and updating design systems
- applying design systems to screen instances
- generating screens from text prompts
- editing screens
- generating variants

## Operational note

After write operations such as `generate_variants` or `edit_screens`, Stitch can briefly expose fresher state through `get_project` or `get_screen` before `list_screens` catches up. When you need the newest generated screen immediately, prefer the returned `screenId` from the mutation result or refresh via `get_project`.
