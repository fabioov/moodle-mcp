import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { jsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/types.js";
import { MoodleClient } from "./moodle/client.js";
import { registerTools } from "./tools/index.js";

export function createServer(moodle: MoodleClient, opts: { jsonSchemaValidator?: jsonSchemaValidator } = {}): McpServer {
  const server = new McpServer({ name: "moodle-mcp", version: "0.1.0" }, opts);
  registerTools(server, moodle);
  return server;
}
