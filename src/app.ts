import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";
import { MoodleClient } from "./moodle/client.js";
import { createServer } from "./server.js";

export interface AppConfig {
  moodleUrl: string;
  moodleToken: string;
  authSecret: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

const enc = new TextEncoder();

/** Constant-time string comparison (works on Node and Cloudflare Workers). */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Web-standard request handler shared by the Node server and the Cloudflare Worker.
 *
 * Auth: `Authorization: Bearer <secret>`, or the secret as a URL path segment
 * (/mcp/<secret>) for clients that can only be given a URL.
 */
export function createHandler(cfg: AppConfig): (req: Request) => Promise<Response> {
  const moodle = new MoodleClient({ url: cfg.moodleUrl, token: cfg.moodleToken }, cfg.fetchImpl);

  return async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/health") return json({ ok: true });

    const m = /^\/mcp(?:\/([^/]+))?\/?$/.exec(url.pathname);
    if (!m) return json({ error: "not found" }, 404);

    let pathSecret = "";
    try { pathSecret = m[1] ? decodeURIComponent(m[1]) : ""; } catch { /* invalid encoding: never matches */ }
    const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
    if (!safeEqual(bearer, cfg.authSecret) && !safeEqual(pathSecret, cfg.authSecret)) {
      return json({ error: "unauthorized" }, 401);
    }
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    // Stateless: a fresh server and transport per request.
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await createServer(moodle, { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() }).connect(transport);
    return transport.handleRequest(req);
  };
}
