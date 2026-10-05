import { z } from "zod";

export const DOC_TYPES = ["essay", "presentation", "work"] as const;
export const LANGUAGES = ["uz-latn", "uz-cyrl", "ru", "en"] as const;
export const UI_LANGUAGES = ["uz-latn", "uz-cyrl", "ru"] as const;
export const TEMPLATE_IDS = ["modern", "minimal", "dark"] as const;
export const EXPORT_FORMATS = ["pdf", "docx", "pptx"] as const;
export const GENERATION_STATUSES = ["pending", "done", "failed"] as const;

export const DocTypeSchema = z.enum(DOC_TYPES);
export const LanguageSchema = z.enum(LANGUAGES);
export const UiLanguageSchema = z.enum(UI_LANGUAGES);
export const TemplateIdSchema = z.enum(TEMPLATE_IDS);
export const ExportFormatSchema = z.enum(EXPORT_FORMATS);

export type DocType = z.infer<typeof DocTypeSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type UiLanguage = z.infer<typeof UiLanguageSchema>;
export type TemplateId = z.infer<typeof TemplateIdSchema>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const SectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  paragraphs: z.array(z.string()).optional(),
  bullets: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const DocumentContentSchema = z.object({
  type: DocTypeSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  plan: z.array(z.string()).optional(),
  sections: z.array(SectionSchema).min(1),
  references: z.array(z.string()).optional(),
});

export type Section = z.infer<typeof SectionSchema>;
export type DocumentContent = z.infer<typeof DocumentContentSchema>;

export const TitleMetaSchema = z
  .object({
    university: z.string().max(200),
    faculty: z.string().max(200),
    subject: z.string().max(200),
    student: z.string().max(200),
    group: z.string().max(50),
    teacher: z.string().max(200),
    city: z.string().max(100),
    year: z.number().int().min(2000).max(2100),
  })
  .partial();

export type TitleMeta = z.infer<typeof TitleMetaSchema>;

/** Size of a document: words for an essay, slides for a presentation, A4 pages for a work. */
export const LENGTH_RULES = {
  essay: { unit: "words", default: 800, min: 400, max: 2000, presets: [500, 800, 1200, 2000] },
  presentation: { unit: "slides", default: 10, min: 5, max: 20, presets: [6, 8, 10, 12, 15, 20] },
  work: { unit: "pages", default: 12, min: 5, max: 25, presets: [6, 8, 10, 15, 20, 25] },
} as const satisfies Record<DocType, { unit: string; default: number; min: number; max: number; presets: number[] }>;

export type LengthUnit = (typeof LENGTH_RULES)[DocType]["unit"];

/** Formats offered for each document type, in the order shown to the user. */
export const FORMATS_BY_TYPE: Record<DocType, ExportFormat[]> = {
  essay: ["docx", "pdf"],
  presentation: ["pptx", "pdf"],
  work: ["docx", "pdf"],
};

export const TOPIC_MIN = 3;
export const TOPIC_MAX = 200;

/** User topic: single line, collapsed whitespace, length-limited (it goes into the prompt as data). */
export const TopicSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(TOPIC_MIN).max(TOPIC_MAX));

export const WORDS_PER_PAGE = 270;

/** Uzbek scripts are the only pair that can be converted into each other. */
export function isUzbek(lang: Language): lang is "uz-latn" | "uz-cyrl" {
  return lang === "uz-latn" || lang === "uz-cyrl";
}

export function withSectionIds(sections: Omit<Section, "id">[]): Section[] {
  return sections.map((s, i) => ({ ...s, id: `s${i + 1}` }));
}

export { parseTitleMeta } from "./meta";
