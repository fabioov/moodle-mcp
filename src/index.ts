#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";
import express from "express";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MoodleClient } from "./moodle/client.js";
import { createServer } from "./server.js";

const need = (k: string) => {
  const v = process.env[k];
  if (!v) { console.error(`Missing env var ${k}`); process.exit(1); }
  return v;
};

const moodle = new MoodleClient({ url: need("MOODLE_URL"), token: need("MOODLE_TOKEN") });

if (process.env.MCP_TRANSPORT === "stdio") {
  await createServer(moodle).connect(new StdioServerTransport());
} else {
  const secret = Buffer.from(need("MCP_AUTH_SECRET"));
  const app = express();
  app.use(express.json());

  app.use("/mcp", (req, res, next) => {
    const got = Buffer.from((req.header("authorization") ?? "").replace(/^Bearer /, ""));
    if (got.length !== secret.length || !timingSafeEqual(got, secret)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  });

  // Stateless: a fresh server/transport per request
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => transport.close());
    await createServer(moodle).connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.all("/mcp", (_req, res) => res.status(405).json({ error: "method not allowed" }));
  app.get("/health", (_req, res) => res.json({ ok: true }));

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.error(`moodle-mcp listening on :${port}/mcp`));
}
