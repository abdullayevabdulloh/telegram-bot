import PptxGenJS from "pptxgenjs";
import type { LoadedImage } from "../images";
import { getTemplate } from "../templates";
import { hex, type ExportInput } from "./common";
import { buildSlides, type Element, type Stroke } from "./slides";

const transparency = (opacity = 1) => Math.round((1 - opacity) * 100);

const line = (stroke?: Stroke): PptxGenJS.ShapeLineProps =>
  stroke ? { color: hex(stroke.color), transparency: transparency(stroke.opacity), width: stroke.width } : { type: "none" };

function draw(pptx: PptxGenJS, slide: PptxGenJS.Slide, el: Element, fonts: { heading: string; body: string }) {
  switch (el.kind) {
    case "rect":
      slide.addShape(el.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
        x: el.x, y: el.y, w: el.w, h: el.h,
        fill: { color: hex(el.fill), transparency: transparency(el.opacity) },
        line: line(el.stroke),
        // Inches, despite the typings that say 0–1 (see genXmlSlideObjects); at most half the shorter side
        ...(el.radius ? { rectRadius: Math.min(el.radius, Math.min(el.w, el.h) / 2) } : {}),
      });
      return;
    case "ellipse":
      slide.addShape(pptx.ShapeType.ellipse, {
        x: el.x, y: el.y, w: el.w, h: el.h,
        fill: { color: hex(el.fill), transparency: transparency(el.opacity) },
        line: line(el.stroke),
      });
      return;
    case "image": {
      // w/h carry the photo's aspect ratio; sizing crops it to the box like CSS object-fit: cover
      const ratio = el.image.height / el.image.width;
      slide.addImage({
        data: `${el.image.mime};base64,${el.image.data.toString("base64")}`,
        x: el.x, y: el.y, w: el.w, h: el.w * ratio,
        sizing: { type: "cover", w: el.w, h: el.h },
      });
      return;
    }
    case "text": {
      // The first paragraph uses the box defaults; following ones carry their own size, color and spacing
      const paragraphs = [{ runs: el.runs }, ...(el.then ?? [])].map((p, i) =>
        p.runs.map((run, j) => ({
          text: run.text,
          options: {
            bold: run.bold ?? false,
            ...("size" in p ? { fontSize: p.size, color: hex(p.color), fontFace: fonts.body } : {}),
            ...("gap" in p && j === 0 ? { paraSpaceBefore: p.gap * 72 } : {}),
            ...(j === p.runs.length - 1 && i < (el.then?.length ?? 0) ? { breakLine: true } : {}),
          },
        })),
      );
      slide.addText(
        paragraphs.flat(),
        {
          x: el.x, y: el.y, w: el.w, h: el.h,
          fontFace: fonts[el.font], fontSize: el.size, color: hex(el.color),
          align: el.align ?? "left", valign: el.valign ?? "top",
          // Office fonts have shorter lines than the Noto Sans the layout was measured with
          margin: 0, lineSpacingMultiple: 1.2, charSpacing: el.spacing,
        },
      );
      return;
    }
  }
}

export async function renderPptx(input: ExportInput): Promise<Buffer> {
  const { content, template, meta, images } = input;
  if (content.type !== "presentation") throw new Error("PPTX is only available for presentations");
  const fonts = getTemplate(template).office;

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = content.title;
  pptx.author = meta?.student ?? "EduGen AI";
  pptx.company = "EduGen AI";

  // Gradient backdrops live in slide masters: stored once per deck, and not selectable while editing a slide
  const masters = new Map<LoadedImage, string>();
  const masterFor = (backdrop: LoadedImage) => {
    let title = masters.get(backdrop);
    if (!title) {
      title = `Backdrop-${masters.size + 1}`;
      pptx.defineSlideMaster({ title, background: { data: `${backdrop.mime};base64,${backdrop.data.toString("base64")}` } });
      masters.set(backdrop, title);
    }
    return title;
  };

  for (const spec of buildSlides(input, images ?? new Map())) {
    const slide = spec.backdrop ? pptx.addSlide({ masterName: masterFor(spec.backdrop) }) : pptx.addSlide();
    if (!spec.backdrop) slide.background = { color: hex(spec.background) };
    for (const el of spec.elements) draw(pptx, slide, el, fonts);
    if (spec.notes) slide.addNotes(spec.notes);
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
