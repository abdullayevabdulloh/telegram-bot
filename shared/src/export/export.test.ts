import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { imageSize } from "../images";
import { FORMATS_BY_TYPE, TEMPLATE_IDS, type DocumentContent } from "../schema";
import { slideColors } from "../templates";
import { latinToCyrillic, mapStrings } from "../translit";
import { renderBackdrop } from "./backdrop";
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

// 16×12 JPEG standing in for a downloaded stock photo
const photo = Buffer.from("/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAADAAAAAD/wAARCAAMABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIDAgIDBQMDAwUGBQUFBQYIBgYGBgYICggICAgICAoKCgoKCgoKDAwMDAwMDg4ODg4PDw8PDw8PDw8P/9sAQwECAgIEBAQHBAQHEAsJCxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/90ABAAB/9oADAMBAAIRAxEAPwDB0LwP/o6/u/0ru9H8Dn7Qv7uvbNC0my8hfkru9H0qx89f3de54zcZVvY4T5H5D4N8f17rc//Z", "base64");
const photoUrl = "https://images.pexels.com/photos/1/test.jpeg";
const slideImage = { url: photoUrl, width: 16, height: 12, credit: "Test Author" };
const images = new Map([[photoUrl, { data: photo, ...imageSize(photo)! }]]);

const LAYOUTS = ["bullets", "image", "cards", "steps", "highlight", "cards"] as const;
const presentation: DocumentContent = {
  type: "presentation",
  title: "Sun’iy intellekt ta’limda",
  subtitle: "Imkoniyatlar va xavflar",
  theme: "education",
  coverImage: slideImage,
  sections: LAYOUTS.map((layout, i) => ({
    id: `s${i + 1}`,
    heading: i === 5 ? "Xulosa" : `${i + 1}-bo‘lim: asosiy g‘oyalar`,
    bullets: ["Shaxsiylashtirish: har bir talabaga mos sur’at", "Tezkorlik: o‘qituvchining vaqtini tejash", "Tahlil: baholashni avtomatlashtirish"],
    notes: "Spiker izohi.",
    layout,
    ...(layout === "image" ? { image: slideImage } : {}),
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
            const file = await exportDocument(format, { content: doc, template, language, meta, images });
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

  it("draws slides without photos and without a theme (older decks)", async () => {
    const plain: DocumentContent = {
      ...presentation,
      theme: undefined,
      coverImage: undefined,
      sections: presentation.sections.map(({ image: _image, layout: _layout, ...s }) => s),
    };
    for (const template of TEMPLATE_IDS) {
      for (const format of ["pptx", "pdf"] as const) {
        const file = await exportDocument(format, { content: plain, template, language: "uz-latn", images: new Map() });
        expect(file.buffer.length).toBeGreaterThan(2_000);
      }
    }
  });

  it("paints gradient backdrops as small PNGs", () => {
    for (const template of ["aurora", "pastel"] as const) {
      const { backdrop } = slideColors(template, "nature");
      for (const image of [renderBackdrop(backdrop!.soft), renderBackdrop(backdrop!.vivid)]) {
        expect(imageSize(image.data)).toEqual({ width: image.width, height: image.height, mime: "image/png" });
        expect(image.data.length).toBeLessThan(100_000);
      }
    }
  });

  it("embeds the photos", async () => {
    const withPhotos = await exportDocument("pptx", { content: presentation, template: "modern", language: "uz-latn", images });
    const without = await exportDocument("pptx", { content: presentation, template: "modern", language: "uz-latn", images: new Map() });
    expect(withPhotos.buffer.length).toBeGreaterThan(without.buffer.length);
  });

  it("rejects formats that do not fit the type", async () => {
    await expect(exportDocument("pptx", { content: essay, template: "modern", language: "uz-latn" })).rejects.toThrow();
    await expect(exportDocument("docx", { content: presentation, template: "modern", language: "uz-latn" })).rejects.toThrow();
  });

  it("builds ASCII file names", () => {
    expect(fileName(essay, "pdf")).toBe("suniy-intellektning-talimdagi-orni_esse.pdf");
    expect(fileName(mapStrings(work, latinToCyrillic), "docx")).toBe("raqamli-iqtisodiyotning-rivojlanishi_mustaqil-ish.docx");
  });
});
