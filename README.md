# Moodle MCP

Open source, **read-only** [MCP](https://modelcontextprotocol.io) server for Moodle. Ask Claude about your
assignments, deadlines, grades, courses, forums and notifications.

## Tools
`get_site_info`, `list_courses`, `get_course_contents`, `list_assignments`, `get_assignment_status`,
`get_upcoming_deadlines`, `get_grades`, `list_forum_discussions`, `get_notifications`.

## Setup
1. In Moodle: *Preferences → Security keys* → copy your **Moodle mobile web service** token
   (the site must have Web Services enabled; some functions may be disabled by your institution).
2. Configure env (see `.env.example`): `MOODLE_URL`, `MOODLE_TOKEN`, `MCP_AUTH_SECRET`.
3. Run: `npm ci && npm run build && npm start` or `docker build -t moodle-mcp . && docker run --env-file .env -p 3000:3000 moodle-mcp`.
4. Expose the server over HTTPS (e.g. Cloudflare Tunnel) and add it as a custom connector in Claude.
   - **Claude.ai** (Settings → Connectors → Add custom connector): URL `https://<your-host>/mcp`, choose
     *No sign-in*, then *Add header* `Authorization: Bearer <MCP_AUTH_SECRET>`.
   - **Claude Code and other clients:** same URL and header.
   - If a client can only be given a URL, use `https://<your-host>/mcp/<MCP_AUTH_SECRET>` (treat it as a password;
     the header is preferred because URLs end up in logs).
   - Generate a strong secret: `openssl rand -hex 24`.

### Deploy on Cloudflare Workers (free, always on, no domain needed)
Runs on `https://moodle-mcp.<your-subdomain>.workers.dev`, so your computer doesn't need to stay on.
You need a free Cloudflare account (check Cloudflare's current free-tier limits).

```bash
npm ci
npx wrangler login
npx wrangler secret put MOODLE_URL        # https://your.moodle.edu
npx wrangler secret put MOODLE_TOKEN      # your Moodle web service token
npx wrangler secret put MCP_AUTH_SECRET   # openssl rand -hex 24
npm run deploy
```
Then add `https://moodle-mcp.<your-subdomain>.workers.dev/mcp` as a custom connector (see above).
Secrets are stored by Cloudflare and never go in the repo. To try it locally first, copy your `.env` values
to a `.dev.vars` file (git-ignored) and run `npm run dev:worker`.

For Claude Desktop / Claude Code (local): set `MCP_TRANSPORT=stdio`.

## Security
Your Moodle token grants access to your account. Keep it only in the server's environment, never commit it.

## Contributing
PRs welcome. `npm test` and `npm run typecheck` must pass. New tools go in `src/tools/`.

## License
MIT
