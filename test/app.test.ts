import { describe, expect, it } from "vitest";
import { createHandler, safeEqual } from "../src/app.js";
import { fixture } from "./helpers.js";

const SECRET = "s3cret-value";
const fakeFetch = (async (_url: any, init: any) => {
  const fn = new URLSearchParams(init.body).get("wsfunction");
  if (fn === "core_webservice_get_site_info") return new Response(JSON.stringify(fixture("core_webservice_get_site_info")));
  return new Response(JSON.stringify({ exception: "e", errorcode: "accessexception", message: `no ${fn}` }));
}) as typeof fetch;

const handler = createHandler({ moodleUrl: "https://moodle.test", moodleToken: "tok", authSecret: SECRET, fetchImpl: fakeFetch });

const rpc = (path: string, body: unknown, headers: Record<string, string> = {}, method = "POST") =>
  handler(new Request(`https://x.test${path}`, {
    method,
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  }));
const list = { jsonrpc: "2.0", id: 1, method: "tools/list" };
const bearer = { authorization: `Bearer ${SECRET}` };

describe("safeEqual", () => {
  it("compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
});

describe("http handler", () => {
  it("serves /health without auth", async () => {
    const r = await handler(new Request("https://x.test/health"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
  it("404 for unknown paths", async () => {
    expect((await handler(new Request("https://x.test/nope"))).status).toBe(404);
  });
  it("401 without credentials, with a wrong bearer, or with a wrong path secret", async () => {
    expect((await rpc("/mcp", list)).status).toBe(401);
    expect((await rpc("/mcp", list, { authorization: "Bearer wrong" })).status).toBe(401);
    expect((await rpc("/mcp/wrong", list)).status).toBe(401);
    expect((await rpc("/mcp/%E0%A4%A", list)).status).toBe(401); // invalid percent-encoding
  });
  it("accepts the bearer header", async () => {
    const r = await rpc("/mcp", list, bearer);
    expect(r.status).toBe(200);
    const body: any = await r.json();
    expect(body.result.tools.map((t: any) => t.name)).toContain("get_upcoming_deadlines");
  });
  it("accepts the secret as a URL path segment", async () => {
    expect((await rpc(`/mcp/${SECRET}`, list)).status).toBe(200);
  });
  it("rejects non-POST methods after auth", async () => {
    expect((await rpc("/mcp", undefined, bearer, "GET")).status).toBe(405);
    expect((await rpc("/mcp", undefined, {}, "GET")).status).toBe(401);
  });
  it("runs a tool end-to-end against the (fake) Moodle", async () => {
    const r = await rpc("/mcp", { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_site_info", arguments: {} } }, bearer);
    const body: any = await r.json();
    expect(JSON.parse(body.result.content[0].text)).toMatchObject({ sitename: "Example University", userid: 42 });
  });
  it("surfaces Moodle errors as MCP tool errors, not HTTP errors", async () => {
    const r = await rpc("/mcp", { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_notifications", arguments: {} } }, bearer);
    expect(r.status).toBe(200);
    const body: any = await r.json();
    expect(body.result.isError).toBe(true);
  });
});
