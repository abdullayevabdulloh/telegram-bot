import { docStrings } from "../i18n";
import { WORDS_PER_PAGE, withSectionIds, type DocType, type DocumentContent, type Language } from "../schema";
import { latinToCyrillic, mapStrings, normalizeUzLatin } from "../translit";
import {
  ChapterOutput,
  EssayOutput,
  PresentationOutput,
  WorkFinalOutput,
  WorkOutlineOutput,
  essayPrompt,
  presentationPrompt,
  systemPrompt,
  tokenBudget,
  workChapterCount,
  workChapterPrompt,
  workFinalPrompt,
  workOutlinePrompt,
  type WritingLanguage,
} from "./prompts";
import type { AIRouter, RoutedResult } from "./router";

export interface GenerateInput {
  type: DocType;
  topic: string;
  language: Language;
  /** Words, slides or pages (see LENGTH_RULES). */
  length: number;
}

export interface ProgressUpdate {
  progress: number;
  stage: { key: "writing" | "outline" | "chapter" | "final"; params?: Record<string, number> };
}

export interface GenerateResult {
  content: DocumentContent;
  ai: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    usedFallback: boolean;
  };
}

type OnProgress = (update: ProgressUpdate) => void | Promise<void>;

/** Sums usage of every AI call made for one document. */
class UsageMeter {
  inputTokens = 0;
  outputTokens = 0;
  provider = "";
  model = "";
  usedFallback = false;

  add<T>(result: RoutedResult<T>): T {
    this.inputTokens += result.usage.inputTokens;
    this.outputTokens += result.usage.outputTokens;
    this.provider = result.provider;
    this.model = result.model;
    this.usedFallback ||= result.usedFallback;
    return result.data;
  }
}

const clean = (s: string) =>
  s
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
const cleanList = (items: string[]) => items.map(clean).filter(Boolean);
// "1. Heading" / "Chapter 2: Heading" → "Heading" (generators add their own numbering)
const cleanHeading = (s: string) => clean(s).replace(/^(\d+[.)]\s*)+/, "");

async function runPool<T>(count: number, concurrency: number, task: (index: number) => Promise<T>): Promise<T[]> {
  const results = new Array<T>(count);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (next < count) {
      const index = next++;
      results[index] = await task(index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function generateDocument(
  router: AIRouter,
  input: GenerateInput,
  onProgress: OnProgress = () => {},
): Promise<GenerateResult> {
  const started = Date.now();
  const meter = new UsageMeter();
  // Cyrillic Uzbek is written in Latin and transliterated: same quality and spelling in both scripts.
  const writing: WritingLanguage = input.language === "uz-cyrl" ? "uz-latn" : input.language;
  const system = systemPrompt(writing);

  let content: DocumentContent;
  if (input.type === "essay") {
    await onProgress({ progress: 10, stage: { key: "writing" } });
    const prompt = essayPrompt(input.topic, input.length, writing);
    const out = meter.add(
      await router.generateJson({
        schema: EssayOutput,
        schemaName: "essay",
        system,
        user: prompt.user,
        maxTokens: tokenBudget(input.length),
      }),
    );
    content = {
      type: "essay",
      title: clean(out.title),
      sections: withSectionIds(
        out.sections.map((s) => ({ heading: cleanHeading(s.heading), paragraphs: cleanList(s.paragraphs) })),
      ),
    };
  } else if (input.type === "presentation") {
    await onProgress({ progress: 10, stage: { key: "writing" } });
    const prompt = presentationPrompt(input.topic, input.length, writing);
    const out = meter.add(
      await router.generateJson({
        schema: PresentationOutput,
        schemaName: "presentation",
        system,
        user: prompt.user,
        maxTokens: tokenBudget(prompt.contentSlides * 120),
      }),
    );
    content = {
      type: "presentation",
      title: clean(out.title),
      subtitle: clean(out.subtitle) || undefined,
      sections: withSectionIds(
        out.slides.map((s) => ({
          heading: cleanHeading(s.title),
          bullets: cleanList(s.bullets).map((b) => b.replace(/^[-•–]\s*/, "").replace(/\.$/, "")),
          notes: clean(s.notes) || undefined,
        })),
      ),
    };
  } else {
    content = await generateWork(router, input, writing, system, meter, onProgress);
  }

  content = mapStrings(content, input.language === "uz-cyrl" ? latinToCyrillic : writing === "uz-latn" ? normalizeUzLatin : (s) => s);

  return {
    content,
    ai: {
      provider: meter.provider,
      model: meter.model,
      inputTokens: meter.inputTokens,
      outputTokens: meter.outputTokens,
      durationMs: Date.now() - started,
      usedFallback: meter.usedFallback,
    },
  };
}

async function generateWork(
  router: AIRouter,
  input: GenerateInput,
  writing: WritingLanguage,
  system: string,
  meter: UsageMeter,
  onProgress: OnProgress,
): Promise<DocumentContent> {
  const s = docStrings(writing);
  const totalWords = input.length * WORDS_PER_PAGE;
  const chapterCount = workChapterCount(input.length);

  await onProgress({ progress: 5, stage: { key: "outline" } });
  const outline = meter.add(
    await router.generateJson({
      schema: WorkOutlineOutput,
      schemaName: "work_outline",
      system,
      user: workOutlinePrompt(input.topic, input.length, chapterCount),
      maxTokens: tokenBudget(400),
    }),
  );
  outline.title = clean(outline.title);
  outline.chapters = outline.chapters
    .filter((c) => clean(c.heading))
    .slice(0, chapterCount)
    .map((c) => ({ heading: cleanHeading(c.heading), subtopics: cleanList(c.subtopics) }));
  if (outline.chapters.length === 0) throw new Error("AI returned an outline without chapters");

  const chapterWords = Math.round((totalWords * 0.78) / outline.chapters.length);
  let done = 0;
  await onProgress({ progress: 15, stage: { key: "chapter", params: { n: 1, total: outline.chapters.length } } });
  const chapters = await runPool(outline.chapters.length, 2, async (index) => {
    const out = meter.add(
      await router.generateJson({
        schema: ChapterOutput,
        schemaName: "work_chapter",
        system,
        user: workChapterPrompt(outline, index, chapterWords),
        maxTokens: tokenBudget(chapterWords),
      }),
    );
    done++;
    await onProgress({
      progress: 15 + Math.round((65 * done) / outline.chapters.length),
      stage: { key: "chapter", params: { n: Math.min(done + 1, outline.chapters.length), total: outline.chapters.length } },
    });
    return cleanList(out.paragraphs);
  });

  await onProgress({ progress: 85, stage: { key: "final" } });
  const introWords = Math.round(totalWords * 0.1);
  const conclusionWords = Math.round(totalWords * 0.08);
  const final = meter.add(
    await router.generateJson({
      schema: WorkFinalOutput,
      schemaName: "work_final",
      system,
      user: workFinalPrompt(outline, introWords, conclusionWords),
      maxTokens: tokenBudget(introWords + conclusionWords + 400),
    }),
  );

  const chapterHeadings = outline.chapters.map((c, i) => `${i + 1}. ${c.heading}`);
  const references = cleanList(final.references);
  return {
    type: "work",
    title: outline.title,
    plan: [s.introduction, ...chapterHeadings, s.conclusion, ...(references.length ? [s.references] : [])],
    sections: withSectionIds([
      { heading: s.introduction, paragraphs: cleanList(final.introduction) },
      ...chapterHeadings.map((heading, i) => ({ heading, paragraphs: chapters[i]! })),
      { heading: s.conclusion, paragraphs: cleanList(final.conclusion) },
    ]),
    references: references.length ? references : undefined,
  };
}
