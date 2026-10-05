import OpenAI, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ZodError } from "zod";
import { AIError, type AIProvider, type JsonRequest, type JsonResult } from "../types";

export interface OpenAIProviderOptions {
  apiKey: string;
  /** OpenAI-compatible endpoint (e.g. Gemini); defaults to api.openai.com. */
  baseURL?: string;
  model: string;
  fastModel?: string;
  timeoutMs: number;
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(private readonly options: OpenAIProviderOptions) {
    // Retries and fallback are handled by AIRouter.
    this.client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL, timeout: options.timeoutMs, maxRetries: 0 });
  }

  async generateJson<T>(request: JsonRequest<T>): Promise<JsonResult<T>> {
    const model = request.fast ? (this.options.fastModel ?? this.options.model) : this.options.model;
    try {
      const completion = await this.client.chat.completions.parse({
        model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        response_format: zodResponseFormat(request.schema, request.schemaName),
        max_completion_tokens: request.maxTokens,
      });
      const message = completion.choices[0]?.message;
      if (message?.refusal) throw new AIError("refusal", message.refusal, this.name);
      if (message?.parsed == null) throw new AIError("invalid_output", "Empty structured output", this.name);
      return {
        data: request.schema.parse(message.parsed),
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
        },
        model: completion.model ?? model,
      };
    } catch (error) {
      throw toAIError(error, this.name);
    }
  }
}

function toAIError(error: unknown, provider: string): AIError {
  if (error instanceof AIError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const wrap = (kind: AIError["kind"]) => new AIError(kind, message, provider, { cause: error });

  if (error instanceof RateLimitError) return wrap(error.code === "insufficient_quota" ? "unavailable" : "rate_limit");
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError || error instanceof NotFoundError) {
    return wrap("unavailable");
  }
  if (error instanceof BadRequestError) return wrap("bad_request");
  if (error instanceof APIConnectionError) return wrap("transient");
  if (error instanceof APIError) return wrap((error.status ?? 500) >= 500 ? "transient" : "bad_request");
  if (error instanceof ZodError || error instanceof SyntaxError) return wrap("invalid_output");
  // Thrown by the SDK's parse helper; not exported from the package root.
  const name = (error as { constructor?: { name?: string } })?.constructor?.name;
  if (name === "LengthFinishReasonError") return wrap("invalid_output");
  if (name === "ContentFilterFinishReasonError") return wrap("refusal");
  return wrap("transient");
}
