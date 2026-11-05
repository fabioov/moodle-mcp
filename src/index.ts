#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHandler } from "./app.js";
import { MoodleClient } from "./moodle/client.js";
import { createServer } from "./server.js";

const need = (k: string) => {
  const v = process.env[k];
  if (!v) { console.error(`Missing env var ${k}`); process.exit(1); }
  return v;
};

const moodleUrl = need("MOODLE_URL");
const moodleToken = need("MOODLE_TOKEN");

if (process.env.MCP_TRANSPORT === "stdio") {
  await createServer(new MoodleClient({ url: moodleUrl, token: moodleToken })).connect(new StdioServerTransport());
} else {
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: createHandler({ moodleUrl, moodleToken, authSecret: need("MCP_AUTH_SECRET") }), port });
  console.error(`moodle-mcp listening on :${port}`);
}
