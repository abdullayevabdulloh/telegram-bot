import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateDocument } from "./generate";
import { RateLimitError } from "openai";
import { toAIError } from "./providers/openai";
import { AIRouter } from "./router";
import { AIError, type AIProvider, type JsonRequest } from "./types";

const request: JsonRequest<{ ok: boolean }> = {
  schema: z.object({ ok: z.boolean() }),
  schemaName: "test",
  system: "s",
  user: "u",
  maxTokens: 100,
};

function provider(name: string, behaviour: (call: number) => unknown): AIProvider & { calls: number } {
  const p = {
    name,
    calls: 0,
    async generateJson<T>(): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number }; model: string }> {
      const result = behaviour(++p.calls);
      if (result instanceof Error) throw result;
      return { data: result as T, usage: { inputTokens: 1, outputTokens: 2 }, model: `${name}-model` };
    },
  };
  return p;
}

const fast = { sleep: async () => {}, retryDelayMs: 0 };

describe("AIRouter", () => {
  it("returns the primary answer", async () => {
    const router = new AIRouter([provider("a", () => ({ ok: true })), provider("b", () => ({ ok: false }))], fast);
    await expect(router.generateJson(request)).resolves.toMatchObject({ data: { ok: true }, provider: "a", usedFallback: false });
  });

  it("retries transient errors on the same provider", async () => {
    const a = provider("a", (n) => (n === 1 ? new AIError("transient", "timeout") : { ok: true }));
    const router = new AIRouter([a], fast);
    await expect(router.generateJson(request)).resolves.toMatchObject({ provider: "a" });
    expect(a.calls).toBe(2);
  });

  it("falls back after transient retries are exhausted", async () => {
    const a = provider("a", () => new AIError("transient", "500"));
    const b = provider("b", () => ({ ok: true }));
    const onFallback = vi.fn();
    const router = new AIRouter([a, b], { ...fast, onFallback });
    await expect(router.generateJson(request)).resolves.toMatchObject({ provider: "b", usedFallback: true });
    expect(a.calls).toBe(2);
    expect(onFallback).toHaveBeenCalledWith("a", expect.any(AIError));
  });

  it("falls back immediately on rate limits", async () => {
    const a = provider("a", () => new AIError("rate_limit", "429"));
    const b = provider("b", () => ({ ok: true }));
    await new AIRouter([a, b], fast).generateJson(request);
    expect(a.calls).toBe(1);
  });

  it("asks once more on invalid output, then falls back", async () => {
    const a = provider("a", () => new AIError("invalid_output", "bad json"));
    const b = provider("b", () => ({ ok: true }));
    await expect(new AIRouter([a, b], fast).generateJson(request)).resolves.toMatchObject({ provider: "b" });
    expect(a.calls).toBe(2);
  });

  it("does not fall back on bad requests and refusals", async () => {
    for (const kind of ["bad_request", "refusal"] as const) {
      const b = provider("b", () => ({ ok: true }));
      const router = new AIRouter([provider("a", () => new AIError(kind, kind)), b], fast);
      await expect(router.generateJson(request)).rejects.toMatchObject({ kind });
      expect(b.calls).toBe(0);
    }
  });

  it("skips the primary while its circuit is open", async () => {
    let now = 0;
    const a = provider("a", () => new AIError("rate_limit", "429"));
    const b = provider("b", () => ({ ok: true }));
    const router = new AIRouter([a, b], {
      ...fast,
      now: () => now,
      breaker: { threshold: 2, windowMs: 1_000, cooldownMs: 5_000 },
    });
    await router.generateJson(request);
    await router.generateJson(request);
    expect(a.calls).toBe(2);
    await router.generateJson(request); // circuit open → straight to b
    expect(a.calls).toBe(2);
    now = 6_000; // cooldown over → probe the primary again
    await router.generateJson(request);
    expect(a.calls).toBe(3);
  });

  it("throws the last error when every provider fails", async () => {
    const router = new AIRouter([provider("a", () => new AIError("unavailable", "no key"))], fast);
    await expect(router.generateJson(request)).rejects.toMatchObject({ kind: "unavailable" });
  });
});

// Fake provider that answers every schema used by generateDocument.
function fakeWriter(): AIProvider {
  return {
    name: "fake",
    async generateJson<T>(req: JsonRequest<T>) {
      const answers: Record<string, unknown> = {
        essay: {
          title: "Sun'iy intellekt",
          sections: [
            { heading: "Kirish", paragraphs: ["Bu **muhim** mavzu.", ""] },
            { heading: "2. Asosiy qism", paragraphs: ["O'zbekistonda ta'lim."] },
            { heading: "Xulosa", paragraphs: ["Yakun."] },
          ],
        },
        presentation: {
          title: "AI ta'limda",
          subtitle: "Qisqa sharh",
          slides: [{ title: "Kirish", bullets: ["- Birinchi punkt.", "Ikkinchi"], notes: "Izoh." }],
        },
        work_outline: {
          title: "Raqamli iqtisodiyot",
          chapters: [
            { heading: "1. Nazariy asoslar", subtopics: ["Tushuncha"] },
            { heading: "Amaliy tahlil", subtopics: ["Tajriba"] },
            { heading: "Ortiqcha bob", subtopics: [] },
          ],
        },
        work_chapter: { paragraphs: ["Bob matni."] },
        work_final: { introduction: ["Kirish matni."], conclusion: ["Xulosa matni."], references: ["Muallif. Kitob. — Toshkent, 2020."] },
      };
      return { data: req.schema.parse(answers[req.schemaName]), usage: { inputTokens: 10, outputTokens: 20 }, model: "fake-1" };
    },
  };
}

describe("generateDocument", () => {
  const router = () => new AIRouter([fakeWriter()], fast);

  it("builds an essay and normalizes Uzbek apostrophes", async () => {
    const { content, ai } = await generateDocument(router(), { type: "essay", topic: "AI", language: "uz-latn", length: 800 });
    expect(content.title).toBe("Sun’iy intellekt");
    expect(content.sections.map((s) => s.heading)).toEqual(["Kirish", "Asosiy qism", "Xulosa"]);
    expect(content.sections[0]!.paragraphs).toEqual(["Bu muhim mavzu."]);
    expect(content.sections[1]!.paragraphs).toEqual(["O‘zbekistonda ta’lim."]);
    expect(content.sections.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(ai).toMatchObject({ provider: "fake", model: "fake-1", inputTokens: 10, outputTokens: 20 });
  });

  it("builds slides and cleans bullets", async () => {
    const { content } = await generateDocument(router(), { type: "presentation", topic: "AI", language: "uz-latn", length: 10 });
    expect(content.subtitle).toBe("Qisqa sharh");
    expect(content.sections[0]).toMatchObject({ heading: "Kirish", bullets: ["Birinchi punkt", "Ikkinchi"], notes: "Izoh." });
  });

  it("writes a work step by step and reports progress", async () => {
    const progress: number[] = [];
    const { content, ai } = await generateDocument(
      router(),
      { type: "work", topic: "Iqtisodiyot", language: "uz-latn", length: 8 },
      (u) => void progress.push(u.progress),
    );
    // 8 pages → 2 chapters; the extra chapter from the model is dropped
    expect(content.plan).toEqual(["Kirish", "1. Nazariy asoslar", "2. Amaliy tahlil", "Xulosa", "Foydalanilgan adabiyotlar"]);
    expect(content.sections.map((s) => s.heading)).toEqual(["Kirish", "1. Nazariy asoslar", "2. Amaliy tahlil", "Xulosa"]);
    expect(content.references).toHaveLength(1);
    expect(progress[0]).toBe(5);
    expect(progress.at(-1)).toBe(85);
    expect(ai.inputTokens).toBe(40); // outline + 2 chapters + final
  });

  it("produces Cyrillic Uzbek by transliteration", async () => {
    const { content } = await generateDocument(router(), { type: "work", topic: "Iqtisodiyot", language: "uz-cyrl", length: 8 });
    expect(content.title).toBe("Рақамли иқтисодиёт");
    expect(content.plan?.[0]).toBe("Кириш");
    expect(content.sections.at(-1)!.heading).toBe("Хулоса");
  });
});

describe("AI output schemas", () => {
  it("convert to strict OpenAI response formats", async () => {
    const { zodResponseFormat } = await import("openai/helpers/zod");
    const { ChapterOutput, EssayOutput, PresentationOutput, WorkFinalOutput, WorkOutlineOutput } = await import("./prompts");
    const schemas = { essay: EssayOutput, presentation: PresentationOutput, work_outline: WorkOutlineOutput, work_chapter: ChapterOutput, work_final: WorkFinalOutput };
    for (const [name, schema] of Object.entries(schemas)) {
      const format = zodResponseFormat(schema, name);
      expect(format.json_schema.strict).toBe(true);
      expect(format.json_schema.schema).toMatchObject({ type: "object", additionalProperties: false });
    }
  });
});

describe("toAIError", () => {
  const rateLimit = (message: string, code?: string) =>
    RateLimitError.generate(429, { error: { message, code } }, message, new Headers()) as RateLimitError;

  it("treats a short 429 as a rate limit", () => {
    expect(toAIError(rateLimit("Too many requests. Please retry in 12.5s."), "p").kind).toBe("rate_limit");
  });

  it("treats an exhausted daily quota as unavailable", () => {
    expect(toAIError(rateLimit("Quota exceeded. Please retry in 17h16m2.8s."), "p").kind).toBe("unavailable");
    expect(toAIError(rateLimit("GenerateRequestsPerDayPerProjectPerModel-FreeTier"), "p").kind).toBe("unavailable");
    expect(toAIError(rateLimit("You exceeded your quota", "insufficient_quota"), "p").kind).toBe("unavailable");
  });
});
