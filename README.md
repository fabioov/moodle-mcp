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
4. Expose `/mcp` over HTTPS (e.g. Cloudflare Tunnel) and add it as a custom connector in Claude.
   Send `Authorization: Bearer <MCP_AUTH_SECRET>`.

For Claude Desktop / Claude Code (local): set `MCP_TRANSPORT=stdio`.

## Security
Your Moodle token grants access to your account. Keep it only in the server's environment, never commit it.

## Contributing
PRs welcome. `npm test` and `npm run typecheck` must pass. New tools go in `src/tools/`.

## License
MIT
