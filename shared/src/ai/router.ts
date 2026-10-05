import { AIError, type AIProvider, type JsonRequest, type JsonResult } from "./types";

export interface RouterOptions {
  /** Extra attempts on the same provider for transient errors. */
  retries: number;
  retryDelayMs: number;
  breaker: { threshold: number; windowMs: number; cooldownMs: number };
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  onFallback?: (from: string, error: AIError) => void;
}

export interface RoutedResult<T> extends JsonResult<T> {
  provider: string;
  usedFallback: boolean;
}

const DEFAULTS: RouterOptions = {
  retries: 1,
  retryDelayMs: 1_000,
  breaker: { threshold: 5, windowMs: 5 * 60_000, cooldownMs: 2 * 60_000 },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

/**
 * Per-process circuit breaker: after `threshold` failures inside `windowMs` the provider is skipped
 * for `cooldownMs`; the first request after that is a probe.
 * TODO(stage 2): keep the state in Redis so all workers share it.
 */
class CircuitBreaker {
  private failures: number[] = [];
  private openUntil = 0;

  constructor(
    private readonly options: RouterOptions["breaker"],
    private readonly now: () => number,
  ) {}

  isOpen(): boolean {
    return this.now() < this.openUntil;
  }

  recordFailure(): void {
    const now = this.now();
    this.failures = [...this.failures.filter((t) => now - t < this.options.windowMs), now];
    if (this.failures.length >= this.options.threshold) {
      this.openUntil = now + this.options.cooldownMs;
      this.failures = [];
    }
  }

  recordSuccess(): void {
    this.failures = [];
    this.openUntil = 0;
  }
}

/** Calls the primary provider and, when it cannot answer, the next ones in order. */
export class AIRouter {
  private readonly options: RouterOptions;
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(
    private readonly providers: AIProvider[],
    options: Partial<RouterOptions> = {},
  ) {
    if (providers.length === 0) throw new Error("AIRouter needs at least one provider");
    this.options = { ...DEFAULTS, ...options };
    for (const p of providers) this.breakers.set(p.name, new CircuitBreaker(this.options.breaker, this.options.now));
  }

  get providerNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  async generateJson<T>(request: JsonRequest<T>): Promise<RoutedResult<T>> {
    let lastError: AIError | undefined;

    for (const [index, provider] of this.providers.entries()) {
      const breaker = this.breakers.get(provider.name)!;
      const isLast = index === this.providers.length - 1;
      if (breaker.isOpen() && !isLast) continue;

      let askedAgain = false;
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await provider.generateJson(request);
          breaker.recordSuccess();
          return { ...result, provider: provider.name, usedFallback: index > 0 };
        } catch (raw) {
          const error =
            raw instanceof AIError ? raw : new AIError("transient", String(raw), provider.name, { cause: raw });
          lastError = error;

          if (error.kind === "bad_request" || error.kind === "refusal") throw error;
          if (error.kind !== "invalid_output") breaker.recordFailure();

          if (error.kind === "transient" && attempt < this.options.retries) {
            await this.options.sleep(this.options.retryDelayMs * 2 ** attempt);
            continue;
          }
          if (error.kind === "invalid_output" && !askedAgain) {
            askedAgain = true;
            continue;
          }
          if (!isLast) this.options.onFallback?.(provider.name, error);
          break;
        }
      }
    }

    throw lastError ?? new AIError("unavailable", "No AI provider could be used");
  }
}
