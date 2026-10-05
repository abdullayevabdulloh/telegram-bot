import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { docStrings } from "../i18n";
import { getTemplate, type Template } from "../templates";
import { yearOf, type ExportInput } from "./common";

// Standard PDF fonts cannot show Cyrillic or ‘ ’ — Noto Sans is embedded instead.
const font = (name: string) => fileURLToPath(new URL(`../../assets/fonts/${name}`, import.meta.url));
const FONTS = {
  Regular: font("NotoSans-Regular.ttf"),
  Bold: font("NotoSans-Bold.ttf"),
  Italic: font("NotoSans-Italic.ttf"),
};

type Doc = PDFKit.PDFDocument;

function createDoc(options: PDFKit.PDFDocumentOptions, title: string): Doc {
  const doc = new PDFDocument({ ...options, bufferPages: true, info: { Title: title, Creator: "EduGen AI" } });
  for (const [name, path] of Object.entries(FONTS)) doc.registerFont(name, path);
  doc.font("Regular");
  return doc;
}

function toBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export function renderPdf(input: ExportInput): Promise<Buffer> {
  return input.content.type === "presentation" ? slidesPdf(input) : documentPdf(input);
}

// ------------------------------------------------------------------ A4 documents

const A4_MARGINS = { top: 57, bottom: 57, left: 85, right: 43 }; // 2 / 2 / 3 / 1.5 cm

function documentPdf({ content, template, language, meta }: ExportInput): Promise<Buffer> {
  const t = getTemplate(template);
  const s = docStrings(language);
  const doc = createDoc({ size: "A4", margins: A4_MARGINS }, content.title);
  const width = doc.page.width - A4_MARGINS.left - A4_MARGINS.right;

  const heading = (text: string, options: { center?: boolean; newPage?: boolean } = {}) => {
    if (options.newPage) doc.addPage();
    else if (doc.y > doc.page.height - A4_MARGINS.bottom - 110) doc.addPage();
    else doc.moveDown(0.8);
    doc.font("Bold").fontSize(15).fillColor(t.print.heading);
    doc.text(text, { width, align: options.center ? "center" : "left" });
    doc.moveDown(0.5);
  };
  const paragraph = (text: string) => {
    doc.font("Regular").fontSize(12).fillColor(t.print.text);
    doc.text(text, { width, align: "justify", indent: 28, lineGap: 4, paragraphGap: 6 });
  };

  if (content.type === "work") {
    workTitlePage(doc, t, s, content.title, meta);
    if (content.plan?.length) {
      heading(s.plan.toUpperCase(), { center: true, newPage: true });
      doc.font("Regular").fontSize(13).fillColor(t.print.text);
      for (const item of content.plan) doc.text(item, { width, lineGap: 6, paragraphGap: 4 });
    }
    for (const section of content.sections) {
      heading(section.heading, { center: true, newPage: true });
      for (const p of section.paragraphs ?? []) paragraph(p);
    }
    if (content.references?.length) {
      heading(s.references, { center: true, newPage: true });
      doc.font("Regular").fontSize(12).fillColor(t.print.text);
      content.references.forEach((ref, i) => doc.text(`${i + 1}. ${ref}`, { width, lineGap: 3, paragraphGap: 6 }));
    }
  } else {
    // Essay: title on the first page, no separate cover.
    if (template !== "minimal") doc.rect(A4_MARGINS.left, A4_MARGINS.top, 40, 4).fill(t.print.accent);
    doc.font("Bold").fontSize(20).fillColor(t.print.heading);
    doc.text(content.title, A4_MARGINS.left, A4_MARGINS.top + 14, { width });
    const byline = [meta?.student, meta?.group, meta?.university].filter(Boolean).join(" · ");
    if (byline) doc.font("Italic").fontSize(11).fillColor(t.print.muted).text(byline, { width });
    doc.moveDown(0.6);
    for (const section of content.sections) {
      heading(section.heading);
      for (const p of section.paragraphs ?? []) paragraph(p);
    }
  }

  addPageNumbers(doc, t.print.muted, content.type === "work" ? 1 : 0);
  return toBuffer(doc);
}

function workTitlePage(doc: Doc, t: Template, s: ReturnType<typeof docStrings>, title: string, meta: ExportInput["meta"]) {
  const { left } = A4_MARGINS;
  const width = doc.page.width - A4_MARGINS.left - A4_MARGINS.right;
  const center = (text: string, size: number, fontName = "Regular", color = t.print.text) =>
    doc.font(fontName).fontSize(size).fillColor(color).text(text, { width, align: "center" });

  doc.y = A4_MARGINS.top;
  if (meta?.university) center(meta.university.toUpperCase(), 13, "Bold");
  if (meta?.faculty) center(meta.faculty, 12);

  doc.y = 280;
  center(s.work, 26, "Bold", t.print.heading);
  doc.moveDown(0.6);
  if (meta?.subject) center(`${s.subject}: ${meta.subject}`, 13);
  doc.moveDown(0.4);
  center(`${s.topic}: ${title}`, 14, "Bold");

  const signatures = [
    meta?.student && `${s.performedBy}: ${meta.student}`,
    meta?.group && `${s.group}: ${meta.group}`,
    meta?.teacher && `${s.checkedBy}: ${meta.teacher}`,
  ].filter(Boolean) as string[];
  if (signatures.length) {
    doc.y = 560;
    doc.font("Regular").fontSize(12).fillColor(t.print.text);
    for (const line of signatures) doc.text(line, left + width / 2, doc.y, { width: width / 2 });
  }

  doc.font("Regular").fontSize(12).fillColor(t.print.text);
  doc.text([meta?.city, yearOf(meta)].filter(Boolean).join(" – "), left, doc.page.height - A4_MARGINS.bottom - 30, {
    width,
    align: "center",
  });
}

function addPageNumbers(doc: Doc, color: string, skipFirst: number) {
  const range = doc.bufferedPageRange();
  for (let i = range.start + skipFirst; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // writing inside the margin must not open a new page
    doc.font("Regular").fontSize(10).fillColor(color);
    doc.text(String(i + 1), 0, doc.page.height - 34, { width: doc.page.width, align: "center", lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
}

// ------------------------------------------------------------------ 16:9 slides

const W = 960;
const H = 540;

/** Largest font size from `sizes` at which `measure` fits into `maxHeight`. */
function fitSize(doc: Doc, sizes: number[], maxHeight: number, measure: () => number): number {
  for (const size of sizes) {
    doc.fontSize(size);
    if (measure() <= maxHeight) return size;
  }
  return sizes.at(-1)!;
}

function slidesPdf({ content, template, language, meta }: ExportInput): Promise<Buffer> {
  const t = getTemplate(template).screen;
  const s = docStrings(language);
  const doc = createDoc({ size: [W, H], margin: 0, autoFirstPage: false }, content.title);
  const page = (bg: string) => {
    doc.addPage();
    doc.rect(0, 0, W, H).fill(bg);
  };

  // Cover
  page(t.coverBg);
  doc.rect(0, H - 40, W, 40).fill(t.accent);
  doc.font("Bold").fillColor(t.coverText);
  const titleSize = fitSize(doc, [44, 38, 32, 28], 200, () => doc.heightOfString(content.title, { width: 820 }));
  doc.fontSize(titleSize).text(content.title, 70, 170, { width: 820 });
  if (content.subtitle) doc.font("Regular").fontSize(20).fillColor(t.coverText).text(content.subtitle, 70, doc.y + 14, { width: 820 });
  const byline = [meta?.student, meta?.university].filter(Boolean).join(" · ");
  if (byline) doc.font("Regular").fontSize(14).text(byline, 70, H - 90, { width: 820 });

  // Content
  content.sections.forEach((slide, index) => {
    page(t.bg);
    doc.rect(0, 0, 12, H).fill(t.primary);
    doc.font("Bold").fillColor(t.primary);
    const headingSize = fitSize(doc, [30, 26, 22], 80, () => doc.heightOfString(slide.heading, { width: 840 }));
    doc.fontSize(headingSize).text(slide.heading, 60, 36, { width: 840 });
    doc.rect(60, doc.y + 8, 70, 4).fill(t.accent);

    const bullets = slide.bullets?.length ? slide.bullets : (slide.paragraphs ?? []);
    const top = doc.y + 32;
    const measure = () =>
      bullets.reduce((sum, b) => sum + doc.heightOfString(b, { width: 800, lineGap: 4 }) + 12, 0);
    doc.font("Regular");
    const size = fitSize(doc, [24, 22, 20, 18, 16, 14], H - top - 50, measure);
    let y = top;
    for (const bullet of bullets) {
      doc.circle(72, y + size * 0.62, 4).fill(t.accent);
      doc.font("Regular").fontSize(size).fillColor(t.text).text(bullet, 92, y, { width: 800, lineGap: 4 });
      y = doc.y + 12;
    }
    doc.font("Regular").fontSize(12).fillColor(t.muted).text(String(index + 2), W - 70, H - 34, { width: 40, align: "right" });
  });

  // Closing slide
  page(t.coverBg);
  doc.font("Bold").fontSize(40).fillColor(t.coverText).text(s.thanks, 60, H / 2 - 30, { width: W - 120, align: "center" });

  return toBuffer(doc);
}
