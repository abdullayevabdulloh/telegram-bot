import { fileURLToPath } from "node:url";
import { z } from "zod";

// Root .env is shared by every workspace. Already-set variables win (prod sets them directly).
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // no .env file — rely on the real environment
}

const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/edugen"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  QUEUE_PREFIX: z.string().default("edugen"),
  WEB_URL: z.string().default("http://localhost:3000"),

  OPENAI_API_KEY: optional,
  OPENAI_BASE_URL: optional,
  OPENAI_MODEL: optional,
  OPENAI_MODEL_FAST: optional,
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),

  // Fallback provider: used only when OpenAI-compatible AI fails. Empty key = no fallback.
  ANTHROPIC_API_KEY: optional,
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  ANTHROPIC_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),

  // Stock photos for presentations (pexels.com/api). Empty = slides without photos.
  PEXELS_API_KEY: optional,

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  BOT_TOKEN: optional,
  BOT_WEBHOOK_DOMAIN: optional,
  BOT_WEBHOOK_SECRET: optional,
  BOT_WEBHOOK_PORT: z.coerce.number().int().positive().default(8080),
  ADMIN_IDS: z
    .preprocess((v) => (typeof v === "string" ? v : ""), z.string())
    .transform((v) =>
      v
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isSafeInteger(n) && n > 0),
    ),
});

export type Config = z.infer<typeof EnvSchema>;

export const config: Config = EnvSchema.parse(process.env);

type OptionalKey = "OPENAI_API_KEY" | "OPENAI_MODEL" | "OPENAI_MODEL_FAST" | "BOT_TOKEN" | "BOT_WEBHOOK_DOMAIN" | "BOT_WEBHOOK_SECRET";

/** Returns a variable that is optional in general but required by the calling service. */
export function requireEnv(key: OptionalKey): string {
  const value = config[key];
  if (!value) throw new Error(`${key} is not set. Fill it in .env (see .env.example).`);
  return value;
}
