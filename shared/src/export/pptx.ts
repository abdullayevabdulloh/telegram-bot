import PptxGenJS from "pptxgenjs";
import { docStrings } from "../i18n";
import { getTemplate } from "../templates";
import { hex, type ExportInput } from "./common";

// LAYOUT_WIDE = 13.33 × 7.5 in (16:9)
const WIDTH = 13.33;

/** Smaller text for fuller slides — prompts already limit bullets to 3–5 × 12 words. */
function bulletFontSize(bullets: string[]): number {
  const chars = bullets.reduce((sum, b) => sum + b.length, 0);
  if (chars <= 200) return 24;
  if (chars <= 320) return 22;
  if (chars <= 450) return 20;
  if (chars <= 600) return 18;
  return 16;
}

export async function renderPptx({ content, template, language, meta }: ExportInput): Promise<Buffer> {
  if (content.type !== "presentation") throw new Error("PPTX is only available for presentations");
  const t = getTemplate(template);
  const c = t.screen;
  const s = docStrings(language);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = content.title;
  pptx.author = meta?.student ?? "EduGen AI";
  pptx.company = "EduGen AI";

  pptx.defineSlideMaster({
    title: "COVER",
    background: { color: hex(c.coverBg) },
    objects: [{ rect: { x: 0, y: 6.95, w: WIDTH, h: 0.55, fill: { color: hex(c.accent) } } }],
  });
  pptx.defineSlideMaster({
    title: "CONTENT",
    background: { color: hex(c.bg) },
    objects: [{ rect: { x: 0, y: 0, w: 0.17, h: 7.5, fill: { color: hex(c.primary) } } }],
    slideNumber: { x: 12.3, y: 6.95, w: 0.7, h: 0.35, color: hex(c.muted), fontSize: 12, fontFace: t.office.body, align: "right" },
  });
  pptx.defineSlideMaster({ title: "END", background: { color: hex(c.coverBg) } });

  // Cover
  const cover = pptx.addSlide({ masterName: "COVER" });
  cover.addText(content.title, {
    x: 0.8, y: 1.9, w: 11.7, h: 2.0,
    fontFace: t.office.heading, fontSize: content.title.length > 60 ? 34 : 42, bold: true,
    color: hex(c.coverText), valign: "bottom", fit: "shrink",
  });
  if (content.subtitle) {
    cover.addText(content.subtitle, {
      x: 0.8, y: 4.05, w: 11.7, h: 0.9, fontFace: t.office.body, fontSize: 20, color: hex(c.coverText), valign: "top",
    });
  }
  const byline = [meta?.student, meta?.university].filter(Boolean).join(" · ");
  if (byline) {
    cover.addText(byline, { x: 0.8, y: 5.9, w: 11.7, h: 0.5, fontFace: t.office.body, fontSize: 14, color: hex(c.coverText) });
  }

  // Content
  for (const section of content.sections) {
    const slide = pptx.addSlide({ masterName: "CONTENT" });
    slide.addText(section.heading, {
      x: 0.6, y: 0.35, w: 12.1, h: 1.0,
      fontFace: t.office.heading, fontSize: section.heading.length > 45 ? 26 : 32, bold: true,
      color: hex(c.primary), valign: "middle", fit: "shrink",
    });
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.38, w: 0.9, h: 0.06, fill: { color: hex(c.accent) }, line: { type: "none" } });

    const bullets = section.bullets?.length ? section.bullets : (section.paragraphs ?? []);
    slide.addText(
      bullets.map((text) => ({ text, options: { bullet: { indent: 20 }, breakLine: true } })),
      {
        x: 0.8, y: 1.65, w: 11.8, h: 5.1,
        fontFace: t.office.body, fontSize: bulletFontSize(bullets), color: hex(c.text),
        valign: "top", paraSpaceAfter: 12, fit: "shrink",
      },
    );
    if (section.notes) slide.addNotes(section.notes);
  }

  // Closing
  pptx.addSlide({ masterName: "END" }).addText(s.thanks, {
    x: 0.8, y: 2.9, w: 11.7, h: 1.5,
    fontFace: t.office.heading, fontSize: 40, bold: true, color: hex(c.coverText), align: "center", valign: "middle",
  });

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
