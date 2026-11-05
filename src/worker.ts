import { createHandler } from "./app.js";

/** Cloudflare Workers entry point. Configure with `wrangler secret put` (see README). */
interface Env {
  MOODLE_URL: string;
  MOODLE_TOKEN: string;
  MCP_AUTH_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    for (const k of ["MOODLE_URL", "MOODLE_TOKEN", "MCP_AUTH_SECRET"] as const) {
      if (!env[k]) return new Response(JSON.stringify({ error: `server misconfigured: ${k} is not set` }), { status: 500 });
    }
    return createHandler({ moodleUrl: env.MOODLE_URL, moodleToken: env.MOODLE_TOKEN, authSecret: env.MCP_AUTH_SECRET })(request);
  },
};
