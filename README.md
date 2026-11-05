# Moodle MCP

[![CI](https://github.com/fabioov/moodle-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/fabioov/moodle-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An open source, **read-only** [MCP](https://modelcontextprotocol.io) server for Moodle. Connect it to Claude
and ask about your assignments, deadlines, grades, courses, forums and notifications in plain language.

> Not affiliated with or endorsed by Moodle Pty Ltd. "Moodle" is a trademark of its owner.

## What you can ask
- "Which assignments do I still have to hand in this month?"
- "What's due this week, and what have I already submitted?"
- "What are my grades in Machine Learning?"
- "Any new announcements in my courses?"
- "Show me the sections and activities of my Computer Graphics course."

## Tools
All tools are read-only and return concise, readable output.

| Tool | What it does | Parameters |
|---|---|---|
| `get_site_info` | Validates the token; site, Moodle version and current user | – |
| `list_courses` | Your courses (current ones by default) | `includePast?` |
| `get_course_contents` | Sections and activities of a course. Each module has `id` and `instance` | `courseId` |
| `list_assignments` | Assignments with due dates, sorted by due date | `courseId?`, `upcomingOnly?`, `limit?` (25) |
| `get_assignment_status` | Submission/grading status, grade and feedback comments | `assignmentId` |
| `get_upcoming_deadlines` | Calendar events + assignments in the next N days, each assignment marked `submitted` or `pending` | `days?` (14), `onlyPending?` |
| `get_grades` | Grade items of a course | `courseId` |
| `list_forum_discussions` | Recent discussions of a forum | `forumId` (the `instance` from `get_course_contents`) |
| `get_notifications` | Recent Moodle notifications | – |

## Requirements
- A Moodle site with **Web Services / mobile app access enabled** (Moodle 4.x; developed against 4.5).
- Your own **web service token** (below). Functions your institution disables simply return an error for that tool.
- Node 20+ (or Docker, or a free Cloudflare account).

## Setup
### 1. Get your Moodle URL and token
- **URL:** the root of your Moodle, without a page or `/webservice`, e.g. `https://moodle.example.edu`
  (if Moodle lives in a subfolder, include it: `https://example.edu/moodle`).
- **Token:** in Moodle, *Preferences → Security keys* shows a key for **Moodle mobile web service**. Some sites
  only show a label there; *Reset* generates a new key (and signs out your Moodle mobile app). Alternatively, if
  you log in with a Moodle username and password (not SSO), request one:
  `curl -s "$MOODLE_URL/login/token.php" -d username=... --data-urlencode password=... -d service=moodle_mobile_app`
  (type the password interactively so it doesn't end up in your shell history).

### 2. Configure
Copy `.env.example` to `.env` and fill in `MOODLE_URL`, `MOODLE_TOKEN` and `MCP_AUTH_SECRET`
(generate the latter with `openssl rand -hex 24`). `.env` is git-ignored.

### 3. Run it, pick one
**Cloudflare Workers (free, always on, no domain needed)**: recommended
```bash
npm ci
npx wrangler login
npx wrangler secret put MOODLE_URL        # https://your.moodle.edu
npx wrangler secret put MOODLE_TOKEN      # your Moodle web service token
npx wrangler secret put MCP_AUTH_SECRET   # openssl rand -hex 24
npm run deploy                            # prints https://moodle-mcp.<you>.workers.dev
```
Check Cloudflare's current free-tier limits. Try it locally first by copying your `.env` values to a
git-ignored `.dev.vars` and running `npm run dev:worker`.

**Docker / Node (self-hosted)**
```bash
docker build -t moodle-mcp . && docker run --env-file .env -p 3000:3000 moodle-mcp
# or: npm ci && npm run build && npm start
```
Then expose it over HTTPS (for example with a Cloudflare Tunnel or Tailscale Funnel).

**Local only (Claude Desktop / Claude Code, stdio):** `MCP_TRANSPORT=stdio node dist/index.js` with
`MOODLE_URL` and `MOODLE_TOKEN` set. `MCP_AUTH_SECRET` is not needed in this mode.

### 4. Add it to Claude
- **Claude.ai:** *Settings → Connectors → Add custom connector*. URL `https://<your-host>/mcp`, choose
  **No sign-in**, then *Add header* `Authorization` = `Bearer <MCP_AUTH_SECRET>`.
- **Claude Code:** `claude mcp add --transport http moodle https://<your-host>/mcp --header "Authorization: Bearer <MCP_AUTH_SECRET>"`
- If a client can only be given a URL, use `https://<your-host>/mcp/<MCP_AUTH_SECRET>`. Treat that URL as a
  password; the header is preferred because URLs end up in logs.

## Security and privacy
- Your token acts as **you**: anyone who can call your endpoint can read what your token can read. Keep
  `MOODLE_TOKEN` and `MCP_AUTH_SECRET` in environment variables or Cloudflare secrets, never in the repo.
- The server is read-only by design and has no write tools.
- Whatever the tools return (grades, messages, names) is sent to Claude as part of your conversation. Check your
  institution's rules on sharing academic data with third-party services before using this, especially if you
  have access to other people's data (for example as a teacher).
- See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Known limitations
- Tested mainly against Moodle 4.5 with a student account. Teacher/admin roles and other versions or plugins
  are untested; reports and fixtures are welcome.
- Sites can disable individual web service functions, so some tools may not work everywhere.
- Large result sets are trimmed (for example, 25 assignments by default) to save context.

## Development
```bash
npm ci
npm test            # unit tests with fixtures (no Moodle needed)
npm run typecheck
npm run dev         # HTTP server on :3000 (needs .env)
npm run dev:worker  # Cloudflare Worker locally (needs .dev.vars)
```
See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License
[MIT](LICENSE)
