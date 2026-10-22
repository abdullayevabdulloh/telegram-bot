import {
  AlignmentType,
  convertMillimetersToTwip as mm,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import { docStrings } from "../i18n";
import { hasTitlePage } from "../schema";
import { getTemplate } from "../templates";
import { hex, yearOf, type ExportInput } from "./common";

// Academic formatting common in Uzbek universities: Times New Roman 14 pt, 1.5 spacing,
// margins left 3 cm / right 1.5 cm / top and bottom 2 cm, first-line indent 1.25 cm.
const FONT = "Times New Roman";
const SIZE = 28; // half-points
const LINE = 360; // 1.5 lines

export async function renderDocx({ content, template, language, meta }: ExportInput): Promise<Buffer> {
  if (content.type === "presentation") throw new Error("DOCX is not available for presentations");
  const color = hex(getTemplate(template).print.heading);
  const s = docStrings(language);

  const body = (text: string) =>
    new Paragraph({
      children: [new TextRun(text)],
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: mm(12.5) },
    });
  const heading = (text: string, level: "1" | "2", pageBreakBefore = false) =>
    new Paragraph({
      text,
      heading: level === "1" ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      alignment: level === "1" ? AlignmentType.CENTER : AlignmentType.LEFT,
      pageBreakBefore,
    });
  const centered = (text: string, options: { bold?: boolean; size?: number; color?: string; before?: number } = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: options.before ?? 0 },
      children: [new TextRun({ text, bold: options.bold, size: options.size, color: options.color })],
    });

  const children: Paragraph[] = [];

  const titlePage = hasTitlePage(content.type);
  if (titlePage) {
    // Title page
    if (meta?.university) children.push(centered(meta.university.toUpperCase(), { bold: true }));
    if (meta?.faculty) children.push(centered(meta.faculty));
    children.push(centered(content.type === "report" ? s.report : s.work, { bold: true, size: 44, color, before: mm(60) }));
    if (meta?.subject) children.push(centered(`${s.subject}: ${meta.subject}`, { before: mm(6) }));
    children.push(centered(`${s.topic}: ${content.title}`, { bold: true, before: mm(4) }));
    const signatures = [
      meta?.student && `${s.performedBy}: ${meta.student}`,
      meta?.group && `${s.group}: ${meta.group}`,
      meta?.teacher && `${s.checkedBy}: ${meta.teacher}`,
    ].filter(Boolean) as string[];
    signatures.forEach((line, i) =>
      children.push(new Paragraph({ text: line, indent: { left: mm(85) }, spacing: { before: i === 0 ? mm(40) : 0 } })),
    );
    children.push(centered([meta?.city, yearOf(meta)].filter(Boolean).join(" – "), { before: mm(signatures.length ? 30 : 90) }));

    // Plan
    if (content.plan?.length) {
      children.push(heading(s.plan.toUpperCase(), "1", true));
      for (const item of content.plan) children.push(new Paragraph({ text: item }));
    }
    for (const section of content.sections) {
      children.push(heading(section.heading, "1", true));
      for (const p of section.paragraphs ?? []) children.push(body(p));
    }
    if (content.references?.length) {
      children.push(heading(s.references, "1", true));
      content.references.forEach((ref, i) =>
        children.push(new Paragraph({ text: `${i + 1}. ${ref}`, indent: { left: mm(7), hanging: mm(7) } })),
      );
    }
  } else {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: content.title, bold: true, size: 32, color })],
      }),
    );
    const byline = [meta?.student, meta?.group, meta?.university].filter(Boolean).join(", ");
    if (byline) children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: byline, italics: true })] }));
    for (const section of content.sections) {
      children.push(heading(section.heading, "2"));
      for (const p of section.paragraphs ?? []) children.push(body(p));
    }
  }

  const pageNumber = new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT] })] })],
  });

  const doc = new Document({
    creator: "EduGen AI",
    title: content.title,
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE }, paragraph: { spacing: { line: LINE } } },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT, size: 32, bold: true, color },
          paragraph: { spacing: { before: 240, after: 240 }, keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT, size: SIZE, bold: true, color },
          paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          titlePage,
          page: { margin: { top: mm(20), bottom: mm(20), left: mm(30), right: mm(15) } },
        },
        footers: { default: pageNumber, first: titlePage ? new Footer({ children: [] }) : pageNumber },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
