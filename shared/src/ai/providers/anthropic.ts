import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ZodError } from "zod";
import { AIError, type AIProvider, type JsonRequest, type JsonResult } from "../types";

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/**
 * Thinking is always on for current Claude models and its tokens count toward max_tokens.
 * Our budgets are sized for the visible JSON only, so give thinking room on top of them.
 */
const THINKING_HEADROOM = 8_000;

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicProviderOptions) {
    // Retries and fallback are handled by AIRouter.
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs, maxRetries: 0 });
  }

  async generateJson<T>(request: JsonRequest<T>): Promise<JsonResult<T>> {
    try {
      const message = await this.client.beta.messages.parse({
        model: this.options.model,
        max_tokens: request.maxTokens + THINKING_HEADROOM,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
        output_config: { format: betaZodOutputFormat(request.schema), effort: request.fast ? "low" : "medium" },
        // On a safety decline the API re-runs the request on a fallback Claude model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (message.stop_reason === "refusal") {
        throw new AIError("refusal", message.stop_details?.explanation ?? "Request declined", this.name);
      }
      if (message.stop_reason === "max_tokens") throw new AIError("invalid_output", "Output was cut off", this.name);
      if (message.parsed_output == null) throw new AIError("invalid_output", "Empty structured output", this.name);
      return {
        data: request.schema.parse(message.parsed_output),
        usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
        model: message.model,
      };
    } catch (error) {
      throw toAnthropicAIError(error, this.name);
    }
  }
}

export function toAnthropicAIError(error: unknown, provider: string): AIError {
  if (error instanceof AIError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const wrap = (kind: AIError["kind"]) => new AIError(kind, message, provider, { cause: error });

  if (error instanceof Anthropic.RateLimitError) return wrap("rate_limit");
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError
  ) {
    return wrap("unavailable");
  }
  if (error instanceof Anthropic.BadRequestError) return wrap("bad_request");
  // Connection errors (and timeouts) subclass APIError, so check them first. 5xx includes 529 overloaded.
  if (error instanceof Anthropic.APIConnectionError) return wrap("transient");
  if (error instanceof Anthropic.InternalServerError) return wrap("transient");
  if (error instanceof Anthropic.APIError) return wrap("bad_request");
  if (error instanceof ZodError || error instanceof SyntaxError) return wrap("invalid_output");
  return wrap("transient");
}
