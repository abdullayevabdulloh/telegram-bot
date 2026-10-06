import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { docStrings, type DocStrings } from "../i18n";
import type { LoadedImage } from "../images";
import type { DocumentContent, Section, SlideImage, SlideLayout, TemplateId } from "../schema";
import { mix, slideColors, type SlideColors } from "../templates";
import type { ExportInput } from "./common";

/**
 * Slide design shared by PPTX and PDF: every slide is laid out here once as boxes in inches
 * (16:9, 13.333 × 7.5 in), and each renderer only draws the boxes. Text sizes are chosen by
 * measuring with the embedded PDF font, which is wider than Office fonts, so text fits in both.
 */

export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;

// Standard PDF fonts cannot show Cyrillic or ‘ ’ — Noto Sans is embedded instead.
const fontPath = (name: string) => fileURLToPath(new URL(`../../assets/fonts/${name}`, import.meta.url));
export const FONTS = {
  Regular: fontPath("NotoSans-Regular.ttf"),
  Bold: fontPath("NotoSans-Bold.ttf"),
  Italic: fontPath("NotoSans-Italic.ttf"),
};

export interface Run {
  text: string;
  bold?: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Element =
  | (Box & { kind: "rect"; fill: string; opacity?: number; radius?: number })
  | (Box & { kind: "ellipse"; fill: string; opacity?: number })
  | (Box & { kind: "image"; image: LoadedImage })
  | (Box & {
      kind: "text";
      runs: Run[];
      /** Points. */
      size: number;
      color: string;
      font: "heading" | "body";
      align?: "left" | "center" | "right";
      valign?: "top" | "middle" | "bottom";
      /** Letter spacing in points. */
      spacing?: number;
      /**
       * Paragraphs that flow right after this text inside the same box. Renderers keep them
       * together, so the stack holds up even when an Office font wraps differently.
       */
      then?: Paragraph[];
    });

export interface Paragraph {
  runs: Run[];
  size: number;
  color: string;
  /** Space before the paragraph, in inches. */
  gap: number;
}

export interface SlideSpec {
  background: string;
  elements: Element[];
  notes?: string;
}

// ------------------------------------------------------------------ text measuring

let measurer: PDFKit.PDFDocument | undefined;

function measureDoc(): PDFKit.PDFDocument {
  if (!measurer) {
    measurer = new PDFDocument({ autoFirstPage: false });
    for (const [name, path] of Object.entries(FONTS)) measurer.registerFont(name, path);
  }
  return measurer;
}

/** Extra space between wrapped lines, in points; the PDF renderer uses the same value. */
export const lineGap = (size: number) => size * 0.12;

const plain = (runs: Run[]) => runs.map((r) => r.text).join("");

/** Height in inches of wrapped text. Bold runs make the whole string count as bold (a safe overestimate). */
function textHeight(runs: Run[], size: number, width: number): number {
  const doc = measureDoc();
  doc.font(runs.some((r) => r.bold) ? "Bold" : "Regular").fontSize(size);
  return doc.heightOfString(plain(runs), { width: width * 72, lineGap: lineGap(size) }) / 72;
}

function textWidth(text: string, size: number, bold = false): number {
  const doc = measureDoc();
  return doc.font(bold ? "Bold" : "Regular").fontSize(size).widthOfString(text) / 72;
}

/** True when every word fits on a line, so no word gets broken in the middle. */
function wordsFit(texts: string[], size: number, width: number, bold = true): boolean {
  return texts.every((t) => t.split(/\s+/).every((word) => textWidth(word, size, bold) <= width));
}

/**
 * Largest size from `sizes` whose measured height fits and for which `ok` holds;
 * the smallest size otherwise.
 */
function fit(
  sizes: number[],
  maxHeight: number,
  height: (size: number) => number,
  ok: (size: number) => boolean = () => true,
): { size: number; height: number } {
  for (const size of sizes) {
    if (!ok(size)) continue;
    const h = height(size);
    if (h <= maxHeight) return { size, height: h };
  }
  const size = sizes.at(-1)!;
  return { size, height: height(size) };
}

/** "Label: explanation" → bold label + text; anything else stays one run. */
function labelled(item: string): { label?: string; body: string } {
  const match = /^([^:]{1,40}):\s+(.+)$/.exec(item);
  return match ? { label: match[1]!.trim(), body: match[2]!.trim() } : { body: item };
}

function itemRuns(item: string): Run[] {
  const { label, body } = labelled(item);
  return label ? [{ text: `${label}: `, bold: true }, { text: body }] : [{ text: body }];
}

// ------------------------------------------------------------------ building blocks

interface Ctx {
  c: SlideColors;
  template: TemplateId;
  s: DocStrings;
  images: Map<string, LoadedImage>;
}

const MARGIN = 0.8;
const CONTENT_W = SLIDE_W - MARGIN * 2;

const text = (box: Box, runs: Run[], size: number, color: string, extra: Partial<Extract<Element, { kind: "text" }>> = {}): Element => ({
  kind: "text", ...box, runs, size, color, font: "body", ...extra,
});

/** Accent bar + slide title; returns the elements and the y where the content can start. */
function header(ctx: Ctx, title: string, x: number, y: number, w: number, maxHeight = 1.35): { elements: Element[]; bottom: number } {
  const runs = [{ text: title, bold: true }];
  const { size, height } = fit([36, 32, 28, 26, 24], maxHeight, (s) => textHeight(runs, s, w), (s) => wordsFit([title], s, w));
  return {
    elements: [
      { kind: "rect", x, y, w: 0.6, h: 0.08, fill: ctx.c.accent },
      text({ x, y: y + 0.25, w, h: height }, runs, size, ctx.c.primary, { font: "heading" }),
    ],
    bottom: y + 0.25 + height,
  };
}

function slideNumber(ctx: Ctx, n: number, color = ctx.c.muted): Element {
  return text({ x: SLIDE_W - 1.6, y: SLIDE_H - 0.6, w: 1.0, h: 0.3 }, [{ text: String(n).padStart(2, "0") }], 11, color, { align: "right" });
}

/**
 * Bullet list with square markers. Items are spread over the area (within limits) and,
 * when `center` is set, the block is centered vertically. Optional thin dividers between items.
 */
function list(
  ctx: Ctx,
  items: string[],
  area: Box,
  options: { sizes?: number[]; center?: boolean; dividers?: boolean; color?: string } = {},
): Element[] {
  if (!items.length) return [];
  const runs = items.map(itemRuns);
  const indent = 0.42;
  const minGap = 0.2;
  const { size, height } = fit(options.sizes ?? [24, 22, 20, 18, 16, 14], area.h, (s) =>
    runs.reduce((sum, r) => sum + textHeight(r, s, area.w - indent), 0) + minGap * (runs.length - 1),
  );
  const heights = runs.map((r) => textHeight(r, size, area.w - indent));
  const gap = runs.length > 1 ? Math.min(0.55, minGap + (area.h - height) / (runs.length - 1) / 2) : 0;
  const block = heights.reduce((a, b) => a + b, 0) + gap * (runs.length - 1);
  let y = options.center ? area.y + Math.max(0, (area.h - block) / 2) : area.y;

  const elements: Element[] = [];
  const firstLine = (size * 1.362) / 72; // Noto Sans line height
  runs.forEach((r, i) => {
    const marker = 0.13;
    elements.push({ kind: "rect", x: area.x, y: y + (firstLine - marker) / 2, w: marker, h: marker, fill: ctx.c.accent, radius: 0.03 });
    elements.push(text({ x: area.x + indent, y, w: area.w - indent, h: heights[i]! }, r, size, options.color ?? ctx.c.text));
    y += heights[i]!;
    if (i < runs.length - 1) {
      if (options.dividers) {
        elements.push({ kind: "rect", x: area.x + indent, y: y + gap / 2, w: area.w - indent, h: 0.012, fill: mix(ctx.c.bg, ctx.c.text, 0.12) });
      }
      y += gap;
    }
  });
  return elements;
}

/** Photo credit on a dark pill in the bottom-left corner of the photo (Pexels asks for attribution). */
function credit(ctx: Ctx, image: SlideImage, box: Box): Element[] {
  if (!image.credit) return [];
  const label = `${ctx.s.photo}: ${image.credit} / Pexels`;
  const w = textWidth(label, 9) + 0.3;
  const x = box.x + 0.25;
  const y = box.y + box.h - 0.55;
  return [
    { kind: "rect", x, y, w, h: 0.3, fill: "#000000", opacity: 0.45, radius: 0.15 },
    text({ x, y: y + 0.06, w, h: 0.2 }, [{ text: label }], 9, "#FFFFFF", { align: "center" }),
  ];
}

const loaded = (ctx: Ctx, image?: SlideImage) => (image ? ctx.images.get(image.url) : undefined);

// ------------------------------------------------------------------ cover and closing

function coverBase(ctx: Ctx, image: LoadedImage | undefined, photo: SlideImage | undefined): { spec: SlideSpec; panel: Box; ink: string } {
  const { c, template } = ctx;
  const elements: Element[] = [];

  if (template === "minimal") {
    if (image) {
      const box = { x: 7.1, y: 0, w: SLIDE_W - 7.1, h: SLIDE_H };
      elements.push({ kind: "image", ...box, image }, { kind: "rect", x: 7.1, y: 0, w: 0.12, h: SLIDE_H, fill: c.accent });
      elements.push(...credit(ctx, photo!, box));
      return { spec: { background: "#FFFFFF", elements }, panel: { x: 0, y: 0, w: 7.1, h: SLIDE_H }, ink: c.text };
    }
    elements.push({ kind: "rect", x: SLIDE_W - 1.3, y: 0, w: 1.3, h: SLIDE_H, fill: c.accent });
    elements.push({ kind: "rect", x: SLIDE_W - 2.0, y: 0, w: 0.25, h: SLIDE_H, fill: mix(c.accent, "#FFFFFF", 0.6) });
    return { spec: { background: "#FFFFFF", elements }, panel: { x: 0, y: 0, w: SLIDE_W - 2.2, h: SLIDE_H }, ink: c.text };
  }

  if (image) {
    const full = { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H };
    elements.push({ kind: "image", ...full, image });
    elements.push({ kind: "rect", ...full, fill: "#000000", opacity: 0.2 });
    elements.push({ kind: "rect", x: 0, y: 0, w: 7.6, h: SLIDE_H, fill: c.coverBg, opacity: 0.9 });
    elements.push({ kind: "rect", x: 7.6, y: 0, w: 0.1, h: SLIDE_H, fill: c.accent });
    elements.push(...credit(ctx, photo!, { x: 7.7, y: 0, w: SLIDE_W - 7.7, h: SLIDE_H }));
    return { spec: { background: c.coverBg, elements }, panel: { x: 0, y: 0, w: 7.6, h: SLIDE_H }, ink: c.coverText };
  }

  // No photo: geometric decoration in the palette colors
  elements.push({ kind: "ellipse", x: 8.4, y: -2.6, w: 7.6, h: 7.6, fill: "#FFFFFF", opacity: 0.07 });
  elements.push({ kind: "ellipse", x: 10.3, y: 4.4, w: 4.2, h: 4.2, fill: c.accent, opacity: 0.9 });
  elements.push({ kind: "ellipse", x: 9.2, y: 3.7, w: 1.4, h: 1.4, fill: "#FFFFFF", opacity: 0.15 });
  return { spec: { background: c.coverBg, elements }, panel: { x: 0, y: 0, w: 9.2, h: SLIDE_H }, ink: c.coverText };
}

function cover(ctx: Ctx, content: DocumentContent, meta: ExportInput["meta"]): SlideSpec {
  const photo = content.coverImage;
  const { spec, panel, ink } = coverBase(ctx, loaded(ctx, photo), photo);
  const x = panel.x + MARGIN;
  const w = panel.w - MARGIN * 2;
  const titleRuns = [{ text: content.title, bold: true }];
  const title = fit([50, 46, 42, 38, 34, 30], 3.3, (s) => textHeight(titleRuns, s, w), (s) => wordsFit([content.title], s, w));
  const subtitleRuns = content.subtitle ? [{ text: content.subtitle }] : [];
  const subtitle = content.subtitle ? fit([22, 20, 18], 1.2, (s) => textHeight(subtitleRuns, s, w)) : { size: 0, height: 0 };
  const block = 0.35 + title.height + (subtitle.height ? 0.3 + subtitle.height : 0);
  let y = Math.max(0.9, (SLIDE_H - block) / 2 - 0.2);

  spec.elements.push({ kind: "rect", x, y, w: 0.9, h: 0.1, fill: ctx.c.accent });
  y += 0.35;
  const then = content.subtitle ? [{ runs: subtitleRuns, size: subtitle.size, color: ink, gap: 0.3 }] : [];
  spec.elements.push(text({ x, y, w, h: block - 0.35 }, titleRuns, title.size, ink, { font: "heading", then }));

  const byline = [meta?.student, meta?.university].filter(Boolean).join(" · ");
  if (byline) spec.elements.push(text({ x, y: SLIDE_H - 1.1, w, h: 0.4 }, [{ text: byline }], 14, ink));
  return spec;
}

function closing(ctx: Ctx, content: DocumentContent): SlideSpec {
  const photo = content.coverImage;
  const { spec, panel, ink } = coverBase(ctx, loaded(ctx, photo), photo);
  const x = panel.x + MARGIN;
  const w = panel.w - MARGIN * 2;
  const runs = [{ text: ctx.s.thanks, bold: true }];
  const thanks = fit([48, 44, 40, 36, 32], 2.4, (s) => textHeight(runs, s, w), (s) => wordsFit([ctx.s.thanks], s, w));
  const y = (SLIDE_H - thanks.height) / 2 - 0.3;
  spec.elements.push({ kind: "rect", x, y: y - 0.45, w: 0.9, h: 0.1, fill: ctx.c.accent });
  spec.elements.push(
    text({ x, y, w, h: thanks.height + 1.2 }, runs, thanks.size, ink, {
      font: "heading", then: [{ runs: [{ text: content.title }], size: 18, color: ink, gap: 0.3 }],
    }),
  );
  return spec;
}

// ------------------------------------------------------------------ content layouts

/** Title on a tinted side panel with a big slide number; points on the right. */
function bulletsSlide(ctx: Ctx, section: Section, items: string[], n: number): SlideSpec {
  const { c } = ctx;
  const panelW = 4.7;
  const runs = [{ text: section.heading, bold: true }];
  const title = fit([34, 30, 28, 26, 24, 22, 20], 3.6, (s) => textHeight(runs, s, panelW - 1.4), (s) => wordsFit([section.heading], s, panelW - 1.4));
  return {
    background: c.bg,
    elements: [
      { kind: "rect", x: 0, y: 0, w: panelW, h: SLIDE_H, fill: c.surface },
      text({ x: MARGIN, y: 0.8, w: 3.0, h: 1.2 }, [{ text: String(n).padStart(2, "0"), bold: true }], 64, c.accent, { font: "heading" }),
      { kind: "rect", x: MARGIN, y: 2.25, w: 0.6, h: 0.08, fill: c.primary },
      text({ x: MARGIN, y: 2.55, w: panelW - 1.4, h: title.height }, runs, title.size, c.primary, { font: "heading" }),
      ...list(ctx, items, { x: panelW + 0.8, y: 0.8, w: SLIDE_W - panelW - 1.6, h: 5.9 }, { center: true, dividers: true }),
      slideNumber(ctx, n),
    ],
  };
}

/** Photo on one half (side alternates), title and points on the other. */
function imageSlide(ctx: Ctx, section: Section, items: string[], n: number, image: LoadedImage): SlideSpec {
  const { c } = ctx;
  const photoW = 5.7;
  const photoLeft = n % 2 === 1;
  const photoBox = { x: photoLeft ? 0 : SLIDE_W - photoW, y: 0, w: photoW, h: SLIDE_H };
  const x = photoLeft ? photoW + 0.75 : MARGIN;
  const w = SLIDE_W - photoW - 1.55;
  const head = header(ctx, section.heading, x, 0.8, w);
  return {
    background: c.bg,
    elements: [
      { kind: "image", ...photoBox, image },
      { kind: "rect", x: photoLeft ? photoW : SLIDE_W - photoW - 0.1, y: 0, w: 0.1, h: SLIDE_H, fill: c.accent },
      ...credit(ctx, section.image!, photoBox),
      ...head.elements,
      ...list(ctx, items, { x, y: head.bottom + 0.45, w, h: 6.75 - head.bottom - 0.45 }, { sizes: [22, 20, 18, 16, 14] }),
      slideNumber(ctx, n),
    ],
  };
}

/** Items as numbered cards in a grid, centered in the space under the title. */
function cardsSlide(ctx: Ctx, section: Section, items: string[], n: number): SlideSpec {
  const { c } = ctx;
  const head = header(ctx, section.heading, MARGIN, 0.6, CONTENT_W);
  const cols = items.length === 4 ? 2 : items.length <= 3 ? items.length : 3;
  const rows = Math.ceil(items.length / cols);
  const gap = 0.3;
  const areaTop = head.bottom + 0.45;
  const areaBottom = 6.9;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const maxCardH = Math.min(rows === 1 ? 3.9 : 2.6, (areaBottom - areaTop - gap * (rows - 1)) / rows);
  const pad = 0.3;
  const badge = rows === 1 ? 0.6 : 0.5;
  const innerW = cardW - pad * 2;
  const parts = items.map(labelled);
  const labels = parts.flatMap((p) => (p.label ? [p.label] : []));
  // Low cards (two rows) put the number next to the label to leave room for the text
  const inline = rows > 1 && labels.length === parts.length;
  const labelW = inline ? innerW - badge - 0.2 : innerW;
  const textTop = inline ? pad : pad + badge + 0.25;
  const room = maxCardH - textTop - pad;

  // One label size and one body size for all cards, so the grid looks even
  const labelSize = fit(
    [22, 20, 18, 16, 14],
    room / 2,
    (s) => Math.max(0, ...labels.map((l) => textHeight([{ text: l, bold: true }], s, labelW))),
    (s) => wordsFit(labels, s, labelW),
  ).size;
  const labelOnly = (label: string) => textHeight([{ text: label, bold: true }], labelSize, labelW);
  const labelHeight = (p: { label?: string }) =>
    !p.label ? 0 : inline ? Math.max(badge, labelOnly(p.label)) + 0.15 : labelOnly(p.label) + 0.1;
  const body = fit(
    labels.length ? [18, 17, 16, 15, 14, 13, 12] : [22, 20, 18, 16, 14],
    room,
    (s) => Math.max(...parts.map((p) => labelHeight(p) + textHeight([{ text: p.body }], s, innerW))),
    (s) => wordsFit(parts.map((p) => p.body), s, innerW, false),
  );
  // Cards only as tall as their content needs, and the grid centered vertically
  const cardH = Math.min(maxCardH, Math.max(textTop + body.height + pad, rows === 1 ? 2.4 : 1.8));
  const gridH = rows * cardH + gap * (rows - 1);
  const top = areaTop + Math.max(0, (areaBottom - areaTop - gridH) / 2 - 0.15);

  const elements: Element[] = [...head.elements];
  parts.forEach((p, i) => {
    const x = MARGIN + (i % cols) * (cardW + gap);
    const y = top + Math.floor(i / cols) * (cardH + gap);
    elements.push({ kind: "rect", x, y, w: cardW, h: cardH, fill: c.surface, radius: 0.15 });
    elements.push({ kind: "rect", x: x + pad, y, w: cardW - pad * 2, h: 0.07, fill: i % 2 ? c.accent : c.primary });
    elements.push({ kind: "ellipse", x: x + pad, y: y + pad, w: badge, h: badge, fill: c.primary });
    elements.push(
      text({ x: x + pad, y: y + pad, w: badge, h: badge }, [{ text: String(i + 1), bold: true }], rows === 1 ? 18 : 15, c.onPrimary, {
        align: "center", valign: "middle", font: "heading",
      }),
    );
    let ty = y + textTop;
    if (p.label) {
      const h = labelOnly(p.label);
      const lx = inline ? x + pad + badge + 0.2 : x + pad;
      const ly = inline ? ty + Math.max(0, (badge - h) / 2) : ty;
      elements.push(text({ x: lx, y: ly, w: labelW, h }, [{ text: p.label, bold: true }], labelSize, c.text, { font: "heading" }));
      ty += labelHeight(p);
    }
    elements.push(text({ x: x + pad, y: ty, w: innerW, h: y + cardH - pad - ty }, [{ text: p.body }], body.size, p.label ? c.muted : c.text));
  });
  elements.push(slideNumber(ctx, n));
  return { background: c.bg, elements };
}

/** Numbered circles on a line, a label and a short text under each. */
function stepsSlide(ctx: Ctx, section: Section, items: string[], n: number): SlideSpec {
  const { c } = ctx;
  const head = header(ctx, section.heading, MARGIN, 0.6, CONTENT_W);
  const cellW = CONTENT_W / items.length;
  const d = 0.9;
  const textW = cellW - 0.35;
  const parts = items.map(labelled);
  const labels = parts.flatMap((p) => (p.label ? [p.label] : []));
  const areaTop = head.bottom + 0.5;
  const room = 6.9 - areaTop - d - 0.35;
  const labelSize = fit(
    [22, 20, 18, 16, 14],
    room / 2,
    (s) => Math.max(0, ...labels.map((l) => textHeight([{ text: l, bold: true }], s, textW))),
    (s) => wordsFit(labels, s, textW),
  ).size;
  const labelHeight = (p: { label?: string }) => (p.label ? textHeight([{ text: p.label, bold: true }], labelSize, textW) + 0.12 : 0);
  const body = fit(
    [18, 17, 16, 15, 14, 13, 12],
    room,
    (s) => Math.max(...parts.map((p) => labelHeight(p) + textHeight([{ text: p.body }], s, textW))),
    (s) => wordsFit(parts.map((p) => p.body), s, textW, false),
  );
  const bodySize = body.size;
  // Circles, labels and texts as one block, centered vertically under the title
  const block = d + 0.35 + body.height;
  const lineY = areaTop + Math.max(0, (6.9 - areaTop - block) / 2 - 0.1) + d / 2;
  const textTop = lineY + d / 2 + 0.35;

  const first = MARGIN + cellW / 2;
  const elements: Element[] = [
    ...head.elements,
    { kind: "rect", x: first, y: lineY - 0.025, w: cellW * (items.length - 1), h: 0.05, fill: mix(c.primary, c.bg, 0.55) },
  ];
  parts.forEach((p, i) => {
    const cx = first + i * cellW;
    const fill = i === parts.length - 1 ? c.accent : c.primary;
    elements.push({ kind: "ellipse", x: cx - d / 2 - 0.08, y: lineY - d / 2 - 0.08, w: d + 0.16, h: d + 0.16, fill: c.bg });
    elements.push({ kind: "ellipse", x: cx - d / 2, y: lineY - d / 2, w: d, h: d, fill });
    elements.push(
      text({ x: cx - d / 2, y: lineY - d / 2, w: d, h: d }, [{ text: String(i + 1), bold: true }], 22, c.onPrimary, {
        align: "center", valign: "middle", font: "heading",
      }),
    );
    let ty = textTop;
    const box = { x: cx - textW / 2, w: textW };
    if (p.label) {
      const h = textHeight([{ text: p.label, bold: true }], labelSize, textW);
      elements.push(text({ ...box, y: ty, h }, [{ text: p.label, bold: true }], labelSize, c.text, { align: "center", font: "heading" }));
      ty += h + 0.12;
    }
    elements.push(text({ ...box, y: ty, h: 6.9 - ty }, [{ text: p.body }], bodySize, p.label ? c.muted : c.text, { align: "center" }));
  });
  elements.push(slideNumber(ctx, n));
  return { background: c.bg, elements };
}

/** One key sentence, large, on a colored slide. */
function highlightSlide(ctx: Ctx, section: Section, items: string[], n: number): SlideSpec {
  const { c, template } = ctx;
  const style =
    template === "minimal"
      ? { bg: "#F4F4F5", ink: c.text, soft: c.muted }
      : template === "dark"
        ? { bg: c.surface, ink: "#FFFFFF", soft: c.muted }
        : { bg: c.primary, ink: "#FFFFFF", soft: mix(c.primary, "#FFFFFF", 0.75) };
  const [statement = section.heading, ...support] = items;
  const w = 10.2;
  const runs = [{ text: statement, bold: true }];
  const main = fit([42, 38, 34, 30, 28, 26], 3.0, (s) => textHeight(runs, s, w), (s) => wordsFit([statement], s, w));
  const elements: Element[] = [
    { kind: "ellipse", x: 9.6, y: 3.9, w: 5.6, h: 5.6, fill: c.accent, opacity: 0.22 },
    { kind: "ellipse", x: 11.6, y: -1.0, w: 2.6, h: 2.6, fill: "#FFFFFF", opacity: 0.1 },
    text({ x: 1.1, y: 0.75, w: 9.0, h: 0.4 }, [{ text: section.heading.toUpperCase(), bold: true }], 14, c.accent, {
      font: "heading", spacing: 2,
    }),
  ];
  // Supporting points flow under the statement in the same box, as many as fit
  const then: Paragraph[] = [];
  let y = 1.9 + main.height;
  for (const [i, line] of support.entries()) {
    const r = itemRuns(line);
    const gap = i === 0 ? 0.5 : 0.15;
    const h = textHeight(r, 18, w);
    if (y + gap + h > 6.9) break;
    then.push({ runs: r, size: 18, color: style.soft, gap });
    y += gap + h;
  }
  elements.push(
    { kind: "rect", x: 1.1, y: 1.9, w: 0.12, h: main.height, fill: c.accent },
    text({ x: 1.55, y: 1.9, w, h: y - 1.9 }, runs, main.size, style.ink, { font: "heading", then }),
  );
  elements.push(slideNumber(ctx, n, style.soft));
  return { background: style.bg, elements };
}

/** The layout a slide is drawn with: the stored one when the content fits it, otherwise a varied default. */
function resolveLayout(section: Section, items: number, index: number, hasImage: boolean): SlideLayout {
  const wanted = section.layout;
  if (wanted === "image" && hasImage) return "image";
  if (wanted === "steps" && items >= 3 && items <= 5) return "steps";
  if (wanted === "cards" && items >= 2 && items <= 6) return "cards";
  if (wanted === "highlight" && items >= 1 && items <= 3) return "highlight";
  if (wanted === "bullets") return "bullets";
  // Older decks without layouts (or a missing photo): alternate so slides do not all look alike.
  return index % 2 === 1 && items >= 2 && items <= 4 ? "cards" : "bullets";
}

export function buildSlides({ content, template, language, meta }: ExportInput, images: Map<string, LoadedImage>): SlideSpec[] {
  const ctx: Ctx = { c: slideColors(template, content.theme), template, s: docStrings(language), images };
  const slides: SlideSpec[] = [cover(ctx, content, meta)];
  content.sections.forEach((section, index) => {
    const items = section.bullets?.length ? section.bullets : (section.paragraphs ?? []);
    const n = index + 2;
    const image = loaded(ctx, section.image);
    const layout = resolveLayout(section, items.length, index, Boolean(image));
    const spec =
      layout === "image" ? imageSlide(ctx, section, items, n, image!)
      : layout === "cards" ? cardsSlide(ctx, section, items, n)
      : layout === "steps" ? stepsSlide(ctx, section, items, n)
      : layout === "highlight" ? highlightSlide(ctx, section, items, n)
      : bulletsSlide(ctx, section, items, n);
    slides.push({ ...spec, notes: section.notes });
  });
  slides.push(closing(ctx, content));
  return slides;
}
