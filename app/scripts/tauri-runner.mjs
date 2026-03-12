import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const userArgs = process.argv.slice(2);
const tauriArgs = userArgs.length > 0 ? userArgs : ["dev"];
const [subcommand, ...restArgs] = tauriArgs;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appDir, "..");

const hasExplicitConfig =
  restArgs.includes("-c") || restArgs.includes("--config");

const configPath = path.join("src-tauri", "tauri.conf.json");
const finalArgs = hasExplicitConfig
  ? [subcommand, ...restArgs]
  : [subcommand, "-c", configPath, ...restArgs];

const tauriBinary = path.resolve(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri"
);

const child = spawn(tauriBinary, finalArgs, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
