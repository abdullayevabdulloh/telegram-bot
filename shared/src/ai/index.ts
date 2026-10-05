import { config, requireEnv } from "../config";
import { logger } from "../logger";
import { OpenAIProvider } from "./providers/openai";
import { AIRouter } from "./router";
import type { AIProvider } from "./types";

export * from "./types";
export { AIRouter, type RoutedResult, type RouterOptions } from "./router";
export { generateDocument, type GenerateInput, type GenerateResult, type ProgressUpdate } from "./generate";

/** Primary provider is OpenAI; a fallback provider is plugged in here in stage 2. */
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
  return new AIRouter(providers, {
    onFallback: (from, error) => logger.warn({ from, kind: error.kind, err: error.message }, "AI provider failed, falling back"),
  });
}
