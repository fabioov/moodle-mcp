export class MoodleError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "MoodleError";
  }
}

export interface MoodleConfig {
  url: string;
  token: string;
}

export class MoodleClient {
  // Call the global fetch through a wrapper: storing `fetch` and calling it as `this.fetchImpl(...)`
  // throws "Illegal invocation" on Cloudflare Workers.
  constructor(
    private cfg: MoodleConfig,
    private fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {}

  async call<T = unknown>(wsfunction: string, params: Record<string, unknown> = {}): Promise<T> {
    const body = new URLSearchParams({
      wstoken: this.cfg.token,
      wsfunction,
      moodlewsrestformat: "json",
    });
    appendParams(body, params);
    const res = await this.fetchImpl(`${this.cfg.url.replace(/\/+$/, "")}/webservice/rest/server.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new MoodleError(`Moodle HTTP ${res.status}`);
    const data = (await res.json()) as any;
    // Moodle reports errors with HTTP 200
    if (data && typeof data === "object" && !Array.isArray(data) && data.exception) {
      const hint =
        data.errorcode === "accessexception" || data.errorcode === "invalidtoken"
          ? " (função não habilitada no seu serviço externo, ou token inválido)"
          : "";
      throw new MoodleError(`${data.message}${hint}`, data.errorcode);
    }
    return data as T;
  }
}

/** Flattens nested params to Moodle's `a[0][b]=c` form. */
export function appendParams(sp: URLSearchParams, value: unknown, prefix = ""): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => appendParams(sp, v, `${prefix}[${i}]`));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) appendParams(sp, v, prefix ? `${prefix}[${k}]` : k);
  } else {
    sp.append(prefix, String(value));
  }
}
