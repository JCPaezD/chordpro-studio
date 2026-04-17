import { spawnSync } from "node:child_process";

export function getRequiredEnv(name) {
  const value = readEnv(name);

  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in your user environment before starting the Stitch MCP server.`,
    );
  }

  return value;
}

export function getServerInfo() {
  return {
    name: "stitch-mcp",
    version: "0.1.0",
  };
}

function readEnv(name) {
  const directValue = process.env[name]?.trim();

  if (directValue) {
    return directValue;
  }

  if (process.platform !== "win32") {
    return "";
  }

  const escapedName = name.replace(/'/g, "''");
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${escapedName}', 'User')`],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}
