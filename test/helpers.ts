import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { MoodleClient, MoodleError } from "../src/moodle/client.js";

export const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

export type Handler = unknown | ((params: any) => unknown);

/** A fake MoodleClient: maps wsfunction -> fixture (or function of the params); records calls. */
export function fakeMoodle(handlers: Record<string, Handler>) {
  const calls: { fn: string; params: any }[] = [];
  const moodle = {
    async call(fn: string, params: any = {}) {
      calls.push({ fn, params });
      if (!(fn in handlers)) throw new Error(`unexpected wsfunction ${fn}`);
      const h = handlers[fn];
      const out = typeof h === "function" ? (h as any)(params) : h;
      if (out && typeof out === "object" && (out as any).exception) throw new MoodleError((out as any).message, (out as any).errorcode);
      return out;
    },
  } as unknown as MoodleClient;
  return { moodle, calls };
}

/** Connects a real MCP client to the server over an in-memory transport. */
export async function connect(handlers: Record<string, Handler>) {
  const { moodle, calls } = fakeMoodle({ core_webservice_get_site_info: fixture("core_webservice_get_site_info"), ...handlers });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await createServer(moodle).connect(st);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(ct);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args });
    const text = r.content[0].text as string;
    return { isError: !!r.isError, text, data: r.isError ? undefined : JSON.parse(text) };
  };
  return { client, call, calls };
}
