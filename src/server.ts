import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MoodleClient } from "./moodle/client.js";
import { registerTools } from "./tools/index.js";

export function createServer(moodle: MoodleClient): McpServer {
  const server = new McpServer({ name: "moodle-mcp", version: "0.1.0" });
  registerTools(server, moodle);
  return server;
}
