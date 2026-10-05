import type { ZodType } from "zod";

/**
 * transient     — network error, timeout, 5xx: retry, then fall back
 * rate_limit    — 429: fall back right away
 * unavailable   — bad key, exhausted quota, unknown model: fall back right away
 * invalid_output — truncated or schema-mismatching JSON: ask once more, then fall back
 * bad_request   — our request is wrong: no fallback (it is a bug)
 * refusal       — safety refusal: no fallback, tell the user
 */
export type AIErrorKind = "transient" | "rate_limit" | "unavailable" | "invalid_output" | "bad_request" | "refusal";

export class AIError extends Error {
  constructor(
    readonly kind: AIErrorKind,
    message: string,
    readonly provider?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AIError";
  }
}

export interface JsonRequest<T> {
  schema: ZodType<T>;
  /** Short identifier for the schema (a-z, 0-9, _). */
  schemaName: string;
  system: string;
  user: string;
  maxTokens: number;
  /** Use the faster/cheaper model when the provider has one. */
  fast?: boolean;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface JsonResult<T> {
  data: T;
  usage: AIUsage;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  generateJson<T>(request: JsonRequest<T>): Promise<JsonResult<T>>;
}
