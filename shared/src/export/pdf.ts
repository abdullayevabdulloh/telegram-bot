import PDFDocument from "pdfkit";
import { docStrings } from "../i18n";
import { getTemplate, type Template } from "../templates";
import { yearOf, type ExportInput } from "./common";
import { buildSlides, FONTS, lineGap, SLIDE_H, SLIDE_W, type Element, type Run } from "./slides";


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

const PT = 72; // slide layouts are in inches

function drawSlideElement(doc: Doc, el: Element) {
  const [x, y, w, h] = [el.x * PT, el.y * PT, el.w * PT, el.h * PT];
  switch (el.kind) {
    case "rect":
      doc.save().fillOpacity(el.opacity ?? 1);
      (el.radius ? doc.roundedRect(x, y, w, h, el.radius * PT) : doc.rect(x, y, w, h)).fill(el.fill);
      doc.restore();
      return;
    case "ellipse":
      doc.save().fillOpacity(el.opacity ?? 1).ellipse(x + w / 2, y + h / 2, w / 2, h / 2).fill(el.fill).restore();
      return;
    case "image":
      doc.save().rect(x, y, w, h).clip();
      doc.image(el.image.data, x, y, { cover: [w, h], align: "center", valign: "center" });
      doc.restore();
      return;
    case "text": {
      const options = { width: w, align: el.align ?? "left", lineGap: lineGap(el.size), characterSpacing: el.spacing ?? 0 };
      const textOf = (run: Run) => run.text;
      doc.font(el.runs.some((r) => r.bold) ? "Bold" : "Regular").fontSize(el.size);
      const height = doc.heightOfString(el.runs.map(textOf).join(""), options);
      const top = el.valign === "middle" ? y + (h - height) / 2 : el.valign === "bottom" ? y + h - height : y;
      doc.fillColor(el.color);
      const paragraph = (runs: Run[], size: number, at: number) => {
        const opts = { ...options, lineGap: lineGap(size) };
        runs.forEach((run, i) => {
          doc.font(run.bold ? "Bold" : "Regular").fontSize(size);
          const last = i === runs.length - 1;
          if (i === 0) doc.text(run.text, x, at, { ...opts, continued: !last });
          else doc.text(run.text, { ...opts, continued: !last });
        });
      };
      paragraph(el.runs, el.size, top);
      for (const p of el.then ?? []) {
        doc.fillColor(p.color);
        paragraph(p.runs, p.size, doc.y + p.gap * PT);
      }
      return;
    }
  }
}

function slidesPdf(input: ExportInput): Promise<Buffer> {
  const doc = createDoc({ size: [SLIDE_W * PT, SLIDE_H * PT], margin: 0, autoFirstPage: false }, input.content.title);
  for (const spec of buildSlides(input, input.images ?? new Map())) {
    doc.addPage();
    doc.rect(0, 0, SLIDE_W * PT, SLIDE_H * PT).fill(spec.background);
    for (const el of spec.elements) drawSlideElement(doc, el);
  }
  return toBuffer(doc);
}
