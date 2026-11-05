import { describe, it, expect, vi } from "vitest";
import { MoodleClient, MoodleError, appendParams } from "../src/moodle/client.js";

const mk = (payload: unknown, status = 200) =>
  new MoodleClient({ url: "https://m.test/", token: "t" }, (async () =>
    new Response(JSON.stringify(payload), { status })) as typeof fetch);

describe("appendParams", () => {
  it("flattens arrays and objects the Moodle way", () => {
    const sp = new URLSearchParams();
    appendParams(sp, { courseids: [1, 2], opts: { a: "x" } });
    expect(sp.toString()).toBe("courseids%5B0%5D=1&courseids%5B1%5D=2&opts%5Ba%5D=x");
  });
});

describe("MoodleClient", () => {
  it("returns data", async () => {
    expect(await mk({ userid: 5 }).call("x")).toEqual({ userid: 5 });
  });
  it("turns HTTP 200 exceptions into MoodleError", async () => {
    await expect(mk({ exception: "e", errorcode: "accessexception", message: "nope" }).call("x"))
      .rejects.toBeInstanceOf(MoodleError);
  });
  it("fails on HTTP errors", async () => {
    await expect(mk({}, 500).call("x")).rejects.toThrow(/500/);
  });
  it("uses the global fetch when none is injected, without losing its `this` (Cloudflare Workers)", async () => {
    const seen: unknown[] = [];
    vi.stubGlobal("fetch", function (this: unknown) {
      seen.push(this);
      return Promise.resolve(new Response(JSON.stringify({ ok: 1 })));
    });
    try {
      expect(await new MoodleClient({ url: "https://m.test", token: "t" }).call("x")).toEqual({ ok: 1 });
      expect(seen[0]).toBe(globalThis);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
