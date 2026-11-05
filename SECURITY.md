# Security Policy

This server holds a **Moodle web service token** (full access to the user's Moodle account, as that user)
and a shared secret that protects its HTTP endpoint. Please treat vulnerabilities seriously.

## Reporting a vulnerability
**Do not open a public issue.** Use GitHub's private reporting:
<https://github.com/fabioov/moodle-mcp/security/advisories/new>

Include what you found, how to reproduce it, and the impact. You should get a first response within a few days.
Please give us reasonable time to fix it before disclosing.

## Scope examples
- Auth bypass on `/mcp` or leaking `MCP_AUTH_SECRET` / `MOODLE_TOKEN` (responses, logs, errors).
- Any tool that can write to Moodle (the project is read-only by design).
- Dependency vulnerabilities that are exploitable through this server.

## Guidance for users
- Keep `MOODLE_TOKEN` and `MCP_AUTH_SECRET` only in environment variables or Cloudflare secrets; never commit them.
- Use a long random `MCP_AUTH_SECRET` (`openssl rand -hex 24`) and prefer the `Authorization` header over the
  `/mcp/<secret>` URL form, since URLs end up in logs.
- If a secret leaks, rotate it. To revoke a Moodle token, reset it under *Preferences → Security keys*.
- Anyone who can call your endpoint can read what your token can read. Don't share the URL or the secret.

## Supported versions
Only the latest release on `main` receives fixes.
