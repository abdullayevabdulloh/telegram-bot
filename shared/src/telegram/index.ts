// Telegram texts and keyboards shared by the bot and the worker (which sends results).
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "telegraf/types";
import type { GenerationStage, IGeneration } from "../db/models";
import { t } from "../i18n";
import { FORMATS_BY_TYPE, type DocumentContent, type ExportFormat, type UiLanguage } from "../schema";

export const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const FORMAT_LABELS: Record<ExportFormat, string> = { pdf: "📄 PDF", docx: "📝 DOCX", pptx: "📊 PPTX" };

/** callback_data must stay under 64 bytes: prefix + 24-char ObjectId. */
export const callbacks = {
  export: (format: ExportFormat, id: string) => `exp:${format}:${id}`,
  convert: (id: string) => `cv:${id}`,
  regenerate: (id: string) => `rg:${id}`,
  open: (id: string) => `op:${id}`,
};

export function progressText(lang: UiLanguage, progress: number, stage?: GenerationStage): string {
  const stageText = stage ? t(lang, `stage.${stage.key}`, stage.params) : "";
  return t(lang, "gen.progress", { percent: progress, stage: stageText });
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Short plain-text preview: slide titles for decks, the opening paragraph otherwise. */
export function previewText(content: DocumentContent, max = 600): string {
  if (content.type === "presentation") {
    return truncate(content.sections.map((s, i) => `${i + 1}. ${s.heading}`).join("\n"), max);
  }
  const first = content.sections.find((s) => s.paragraphs?.length)?.paragraphs?.[0] ?? "";
  return truncate(first, max);
}

export function doneText(generation: Pick<IGeneration, "content" | "type">, lang: UiLanguage): string {
  const content = generation.content!;
  const parts = [t(lang, "gen.done", { title: escapeHtml(content.title), preview: escapeHtml(previewText(content)) })];
  if (generation.type === "work" && content.references?.length) parts.push(t(lang, "gen.referencesWarning"));
  parts.push(t(lang, "gen.chooseFormat"));
  return parts.join("\n\n");
}

export function resultKeyboard(generation: Pick<IGeneration, "type" | "language"> & { id: string }, lang: UiLanguage): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [
    FORMATS_BY_TYPE[generation.type].map((format) => ({
      text: FORMAT_LABELS[format],
      callback_data: callbacks.export(format, generation.id),
    })),
  ];
  if (generation.language === "uz-latn" || generation.language === "uz-cyrl") {
    rows.push([
      {
        text: t(lang, generation.language === "uz-latn" ? "btn.toCyrillic" : "btn.toLatin"),
        callback_data: callbacks.convert(generation.id),
      },
    ]);
  }
  rows.push([{ text: t(lang, "btn.regenerate"), callback_data: callbacks.regenerate(generation.id) }]);
  return { inline_keyboard: rows };
}
