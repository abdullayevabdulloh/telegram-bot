import { config, requireEnv } from "../config";
import { logger } from "../logger";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import { AIRouter } from "./router";
import type { AIProvider } from "./types";

export * from "./types";
export { AIRouter, type RoutedResult, type RouterOptions } from "./router";
export { generateDocument, type GenerateInput, type GenerateResult, type ProgressUpdate } from "./generate";

/** Primary provider is OpenAI-compatible (Gemini); Claude is the fallback when ANTHROPIC_API_KEY is set. */
export function createAIRouter(): AIRouter {
  const providers: AIProvider[] = [
    new OpenAIProvider({
      apiKey: requireEnv("OPENAI_API_KEY"),
      baseURL: config.OPENAI_BASE_URL,
      model: requireEnv("OPENAI_MODEL"),
      fastModel: config.OPENAI_MODEL_FAST,
      timeoutMs: config.OPENAI_TIMEOUT_MS,
    }),
  ];
  if (config.ANTHROPIC_API_KEY) {
    providers.push(
      new AnthropicProvider({
        apiKey: config.ANTHROPIC_API_KEY,
        model: config.ANTHROPIC_MODEL,
        timeoutMs: config.ANTHROPIC_TIMEOUT_MS,
      }),
    );
  }
  return new AIRouter(providers, {
    onFallback: (from, error) => logger.warn({ from, kind: error.kind, err: error.message }, "AI provider failed, falling back"),
  });
}
