import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { FORMATS_BY_TYPE, TEMPLATE_IDS, type DocumentContent } from "../schema";
import { latinToCyrillic, mapStrings } from "../translit";
import { exportDocument, fileName } from "./index";

const paragraph =
  "Sun’iy intellekt bugungi kunda ta’lim tizimining ajralmas qismiga aylanib bormoqda. O‘qituvchilar va o‘quvchilar g‘oyalarni tezroq sinab ko‘rishlari mumkin.";

const essay: DocumentContent = {
  type: "essay",
  title: "Sun’iy intellektning ta’limdagi o‘rni",
  sections: ["Kirish", "Imkoniyatlar", "Xavflar", "Xulosa"].map((heading, i) => ({
    id: `s${i + 1}`,
    heading,
    paragraphs: [paragraph, paragraph, paragraph],
  })),
};

const work: DocumentContent = {
  type: "work",
  title: "Raqamli iqtisodiyotning rivojlanishi",
  plan: ["Kirish", "1. Nazariy asoslar", "2. Amaliy tahlil", "Xulosa", "Foydalanilgan adabiyotlar"],
  sections: ["Kirish", "1. Nazariy asoslar", "2. Amaliy tahlil", "Xulosa"].map((heading, i) => ({
    id: `s${i + 1}`,
    heading,
    paragraphs: Array.from({ length: 8 }, () => paragraph),
  })),
  references: ["Karimov A. Iqtisodiyot nazariyasi. — Toshkent: O‘qituvchi, 2019."],
};

const presentation: DocumentContent = {
  type: "presentation",
  title: "Sun’iy intellekt ta’limda",
  subtitle: "Imkoniyatlar va xavflar",
  sections: Array.from({ length: 6 }, (_, i) => ({
    id: `s${i + 1}`,
    heading: i === 5 ? "Xulosa" : `${i + 1}-bo‘lim: asosiy g‘oyalar`,
    bullets: ["Shaxsiylashtirilgan ta’lim imkoniyatlari", "O‘qituvchining vaqtini tejash", "Baholashni avtomatlashtirish va tahlil qilish"],
    notes: "Spiker izohi.",
  })),
};

const meta = { university: "Toshkent davlat iqtisodiyot universiteti", student: "Aliyev Vali", group: "IQ-21", teacher: "Karimova N.", city: "Toshkent", year: 2026, subject: "Iqtisodiyot" };

const MAGIC = { pdf: "%PDF", docx: "PK", pptx: "PK" } as const;
const out = process.env.EXPORT_SAMPLES_DIR;

describe("exportDocument", () => {
  for (const content of [essay, work, presentation]) {
    for (const format of FORMATS_BY_TYPE[content.type]) {
      for (const template of TEMPLATE_IDS) {
        for (const language of ["uz-latn", "uz-cyrl"] as const) {
          it(`${content.type} → ${format} (${template}, ${language})`, async () => {
            const doc = language === "uz-cyrl" ? mapStrings(content, latinToCyrillic) : content;
            const file = await exportDocument(format, { content: doc, template, language, meta });
            expect(file.buffer.subarray(0, MAGIC[format].length).toString()).toBe(MAGIC[format]);
            expect(file.buffer.length).toBeGreaterThan(2_000);
            if (out) {
              await mkdir(out, { recursive: true });
              await writeFile(`${out}/${content.type}-${template}-${language}.${format}`, file.buffer);
            }
          });
        }
      }
    }
  }

  it("rejects formats that do not fit the type", async () => {
    await expect(exportDocument("pptx", { content: essay, template: "modern", language: "uz-latn" })).rejects.toThrow();
    await expect(exportDocument("docx", { content: presentation, template: "modern", language: "uz-latn" })).rejects.toThrow();
  });

  it("builds ASCII file names", () => {
    expect(fileName(essay, "pdf")).toBe("suniy-intellektning-talimdagi-orni_esse.pdf");
    expect(fileName(mapStrings(work, latinToCyrillic), "docx")).toBe("raqamli-iqtisodiyotning-rivojlanishi_mustaqil-ish.docx");
  });
});
