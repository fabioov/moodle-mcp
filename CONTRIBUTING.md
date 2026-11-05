# Contributing

Thanks for helping! Contributions of all sizes are welcome.

## Setup
```bash
npm ci
cp .env.example .env   # fill in MOODLE_URL, MOODLE_TOKEN, MCP_AUTH_SECRET
npm run dev            # HTTP on :3000, or MCP_TRANSPORT=stdio
npm test && npm run typecheck
```
Try tools interactively with `npx @modelcontextprotocol/inspector`.

## Adding a tool
1. Add it in `src/tools/` using `server.registerTool` with a zod `inputSchema`.
2. Call Moodle through `MoodleClient.call(wsfunction, params)`; wrap the handler in `safe(...)`.
3. Return concise, readable data (ISO dates, only useful fields) to save context.
4. Add a test in `test/tools.test.ts`. Put the Moodle response in `test/fixtures/<wsfunction>.json`
   (invented data, in the real response shape) and use `connect({ wsfunction: fixture(...) })` from
   `test/helpers.ts`: it runs your tool through a real MCP client against a fake Moodle and records the
   calls, so you can assert on both output and the parameters sent to Moodle. "Now" is frozen in the tests.
5. List the tool in the README.

## Rules
- v1 is **read-only**. Write actions need a prior issue/discussion.
- Never commit tokens, URLs of private instances, or real student data (including in fixtures).
- Moodle sites differ: handle disabled functions gracefully and note the Moodle version you tested on.

## Pull requests
Keep them focused, fill in the template, and make sure CI is green.
