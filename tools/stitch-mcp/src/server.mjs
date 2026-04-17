import path from "node:path";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getServerInfo } from "./config.mjs";
import { toolErrorResult, formatError } from "./errors.mjs";
import { registerReadTools } from "./tools/read-tools.mjs";
import { registerMutationTools } from "./tools/mutation-tools.mjs";
import { toolSuccess } from "./formatters.mjs";

export function createServer() {
  const server = new McpServer(getServerInfo(), {
    capabilities: {
      logging: {},
    },
  });

  registerSafeTools(server, registerReadTools);
  registerSafeTools(server, registerMutationTools);

  return server;
}

function registerSafeTools(server, registerTools) {
  const originalRegisterTool = server.registerTool.bind(server);

  server.registerTool = (name, config, cb) =>
    originalRegisterTool(name, config, async (args, extra) => {
      try {
        const result = await cb(args, extra);
        return toolSuccess(`${name} result`, result);
      } catch (error) {
        return toolErrorResult(`${name} failed: ${formatError(error)}`);
      }
    });

  registerTools(server);

  server.registerTool = originalRegisterTool;
}

export async function startServer() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  startServer().catch((error) => {
    const message = formatError(error);
    process.stderr.write(`stitch-mcp failed to start: ${message}\n`);
    process.exitCode = 1;
  });
}
