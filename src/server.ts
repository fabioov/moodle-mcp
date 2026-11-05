import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { jsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/types.js";
import { MoodleClient } from "./moodle/client.js";
import { registerTools } from "./tools/index.js";

/** Keep in sync with package.json (checked by a test). */
export const VERSION = "0.1.1";

export function createServer(moodle: MoodleClient, opts: { jsonSchemaValidator?: jsonSchemaValidator } = {}): McpServer {
  const server = new McpServer({ name: "moodle-mcp", version: VERSION }, opts);
  registerTools(server, moodle);
  return server;
}
