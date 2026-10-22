import { cyrillicToLatin } from "../translit";
import { TitleMetaSchema, type TitleMeta } from "./index";

// Labels users type on the title-page form, normalised to lowercase Latin without apostrophes.
const ALIASES: Record<string, keyof TitleMeta> = {
  otm: "university",
  universitet: "university",
  institut: "university",
  vuz: "university",
  maktab: "university",
  fakultet: "faculty",
  fan: "subject",
  predmet: "subject",
  talaba: "student",
  student: "student",
  fish: "student",
  bajardi: "student",
  guruh: "group",
  gruppa: "group",
  oqituvchi: "teacher",
  ustoz: "teacher",
  tekshirdi: "teacher",
  prepodavatel: "teacher",
  shahar: "city",
  gorod: "city",
  yil: "year",
  god: "year",
};

function normaliseLabel(label: string): string {
  return cyrillicToLatin(label)
    .toLowerCase()
    .replace(/[ʻʼ‘’'`´.\s]/g, "");
}

/**
 * Parses "Label: value" lines (Uzbek or Russian labels, any script) into title-page fields.
 * Unknown labels and empty values are ignored.
 */
export function parseTitleMeta(text: string): TitleMeta {
  const raw: Record<string, string | number> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([^:]{1,40}):\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const field = ALIASES[normaliseLabel(match[1]!)];
    const value = match[2]!.replace(/\p{Cc}/gu, " ").trim();
    if (!field || !value) continue;
    if (field === "year") {
      const year = Number.parseInt(value, 10);
      if (Number.isFinite(year)) raw.year = year;
    } else {
      raw[field] = value.slice(0, field === "group" ? 50 : field === "city" ? 100 : 200);
    }
  }
  const parsed = TitleMetaSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
