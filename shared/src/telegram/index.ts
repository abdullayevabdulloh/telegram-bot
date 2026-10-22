// Telegram texts and keyboards shared by the bot and the worker (which sends results).
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "telegraf/types";
import type { GenerationStage, IGeneration } from "../db/models";
import { docStrings, t } from "../i18n";
import { FORMATS_BY_TYPE, hasTitlePage, type DocumentContent, type ExportFormat, type Language, type UiLanguage } from "../schema";

export const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const FORMAT_LABELS: Record<ExportFormat, string> = { pdf: "📄 PDF", docx: "📝 DOCX", pptx: "📊 PPTX" };

/** callback_data must stay under 64 bytes: prefix + 24-char ObjectId. */
export const callbacks = {
  export: (format: ExportFormat, id: string) => `exp:${format}:${id}`,
  convert: (id: string) => `cv:${id}`,
  regenerate: (id: string) => `rg:${id}`,
  open: (id: string) => `op:${id}`,
  text: (id: string) => `txt:${id}`,
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
  if (hasTitlePage(generation.type) && content.references?.length) parts.push(t(lang, "gen.referencesWarning"));
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
  if (generation.type !== "presentation") {
    rows.push([{ text: t(lang, "btn.readText"), callback_data: callbacks.text(generation.id) }]);
  }
  rows.push([{ text: t(lang, "btn.regenerate"), callback_data: callbacks.regenerate(generation.id) }]);
  return { inline_keyboard: rows };
}

/** Keyboard under a failed generation: the stored parameters let the user simply try again. */
export function retryKeyboard(generationId: string, lang: UiLanguage): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: t(lang, "btn.retry"), callback_data: callbacks.regenerate(generationId) }]] };
}

/** Telegram allows 4096 characters per message (counted without HTML tags); leave room for headings. */
export const TELEGRAM_TEXT_LIMIT = 3500;

export interface TextBlock {
  text: string;
  bold?: boolean;
}

/** Cuts text into pieces of at most `max` characters: at sentence ends, then at spaces, then anywhere. */
function splitLong(text: string, max: number): string[] {
  const pieces: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    const sentenceEnd = Math.max(...[". ", "! ", "? ", "… "].map((end) => window.lastIndexOf(end)));
    let cut = sentenceEnd > max / 2 ? sentenceEnd + 1 : window.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/**
 * Packs text blocks into HTML messages of at most `max` visible characters, keeping their order.
 * Blocks are joined with blank lines; a block longer than a message is split at sentences or spaces.
 * Every piece is escaped on its own, so a tag or an entity is never cut in half.
 */
export function splitForTelegram(blocks: TextBlock[], max = TELEGRAM_TEXT_LIMIT): string[] {
  const messages: string[] = [];
  let parts: string[] = [];
  let length = 0;
  const flush = () => {
    if (parts.length) messages.push(parts.join("\n\n"));
    parts = [];
    length = 0;
  };
  for (const block of blocks) {
    for (const piece of splitLong(block.text, max)) {
      const added = (parts.length ? 2 : 0) + piece.length;
      if (length + added > max) flush();
      const html = escapeHtml(piece);
      parts.push(block.bold ? `<b>${html}</b>` : html);
      length += (parts.length > 1 ? 2 : 0) + piece.length;
    }
  }
  flush();
  return messages;
}

/** Full text of an essay, work or report as Telegram messages: title, sections, references, reminder. */
export function documentMessages(content: DocumentContent, language: Language, ui: UiLanguage): string[] {
  const s = docStrings(language);
  const blocks: TextBlock[] = [{ text: content.title, bold: true }];
  for (const section of content.sections) {
    blocks.push({ text: section.heading, bold: true });
    for (const paragraph of section.paragraphs ?? section.bullets ?? []) blocks.push({ text: paragraph });
  }
  if (content.references?.length) {
    blocks.push({ text: s.references, bold: true });
    content.references.forEach((ref, i) => blocks.push({ text: `${i + 1}. ${ref}` }));
  }
  blocks.push({ text: t(ui, "text.reminder") });
  return splitForTelegram(blocks);
}
