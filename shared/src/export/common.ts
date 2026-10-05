import type { DocType, DocumentContent, ExportFormat, Language, TemplateId, TitleMeta } from "../schema";
import { cyrillicToLatin } from "../translit";

export interface ExportInput {
  content: DocumentContent;
  template: TemplateId;
  language: Language;
  meta?: TitleMeta;
}

export interface ExportedFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export const MIME_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const TYPE_SUFFIX: Record<DocType, string> = {
  essay: "esse",
  presentation: "taqdimot",
  work: "mustaqil-ish",
};

/** ASCII file name: "Sun’iy intellekt" → "suniy-intellekt_esse.pdf". */
export function fileName(content: DocumentContent, format: ExportFormat): string {
  const slug = cyrillicToLatin(content.title)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[ʻʼ‘’'`´]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${slug || "edugen"}_${TYPE_SUFFIX[content.type]}.${format}`;
}

/** pptxgenjs and docx want colors without "#". */
export const hex = (color: string) => color.replace("#", "");

export const yearOf = (meta?: TitleMeta) => meta?.year ?? new Date().getFullYear();
