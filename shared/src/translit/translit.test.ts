import { describe, expect, it } from "vitest";
import { cyrillicToLatin, detectScript, latinToCyrillic, mapStrings, normalizeUzLatin } from "./index";

// [Latin (canonical output), Cyrillic]
const PAIRS: [string, string][] = [
  ["O‘zbekiston", "Ўзбекистон"],
  ["shahar", "шаҳар"],
  ["Shahar", "Шаҳар"],
  ["SHAHAR", "ШАҲАР"],
  ["yo‘l", "йўл"],
  ["Is’hoq", "Исҳоқ"],
  ["ma’no", "маъно"],
  ["sun’iy intellekt", "сунъий интеллект"],
  ["eshik", "эшик"],
  ["aeroport", "аэропорт"],
  ["yer", "ер"],
  ["poyezd", "поезд"],
  ["choy", "чой"],
  ["g‘alaba", "ғалаба"],
  ["tog‘", "тоғ"],
  ["yaxshi", "яхши"],
  ["dunyo", "дунё"],
  ["yuz", "юз"],
  ["Ya’ni", "Яъни"],
  ["qo‘shiq", "қўшиқ"],
  ["xalq", "халқ"],
  ["hayot", "ҳаёт"],
  ["sirk", "цирк"],
  ["konsert", "концерт"],
  ["sentabr", "сентябрь"],
  ["kompyuter", "компьютер"],
  ["militsiya", "милиция"],
  ["funksiya", "функция"],
  ["pensiya", "пенсия"],
  ["konferensiyada", "конференцияда"],
  ["AQSH", "АҚШ"],
  ["O‘ZBEKISTON", "ЎЗБЕКИСТОН"],
  ["ilmiy-ekspert", "илмий-эксперт"],
];

describe("translit", () => {
  it.each(PAIRS)("%s ↔ %s", (latin, cyrillic) => {
    expect(latinToCyrillic(latin)).toBe(cyrillic);
    expect(cyrillicToLatin(cyrillic)).toBe(latin);
  });

  it("accepts every apostrophe variant for o‘ and g‘", () => {
    for (const a of ["'", "`", "ʻ", "’", "‘"]) {
      expect(latinToCyrillic(`o${a}zbek tog${a}`)).toBe("ўзбек тоғ");
    }
  });

  it("converts stems of loanwords with suffixes", () => {
    expect(latinToCyrillic("sentabrda")).toBe("сентябрда");
    expect(cyrillicToLatin("сентябрда")).toBe("sentabrda");
    expect(latinToCyrillic("kompyuterlar")).toBe("компьютерлар");
  });

  it("keeps URLs, e-mails, placeholders and known Latin names", () => {
    const text = "Salom {name}! https://edugen.uz/o'quv info@edugen.uz PDF va IT, Python";
    expect(latinToCyrillic(text)).toBe("Салом {name}! https://edugen.uz/o'quv info@edugen.uz PDF ва IT, Python");
  });

  it("converts the Uzbek word 'it' but keeps the acronym 'IT'", () => {
    expect(latinToCyrillic("it va IT")).toBe("ит ва IT");
  });

  it("leaves quotation marks alone", () => {
    expect(latinToCyrillic("'Salom' dedi")).toBe("'Салом' деди");
  });

  it("keeps punctuation, digits and line breaks", () => {
    expect(latinToCyrillic("1. Kirish\n2. Xulosa — 2026-yil.")).toBe("1. Кириш\n2. Хулоса — 2026-йил.");
  });

  it("detects the script", () => {
    expect(detectScript("Ўзбекистон Республикаси")).toBe("cyrillic");
    expect(detectScript("O‘zbekiston Respublikasi")).toBe("latin");
    expect(detectScript("123 !!")).toBeNull();
  });

  it("normalizes apostrophes in Latin text", () => {
    expect(normalizeUzLatin("O'zbekiston ma'no g`oya sunʼiy")).toBe("O‘zbekiston ma’no g‘oya sun’iy");
  });

  it("maps strings of a document but keeps ids and types", () => {
    const doc = { type: "essay", title: "Shahar", sections: [{ id: "s1", heading: "Kirish", paragraphs: ["Salom"] }] };
    expect(mapStrings(doc, latinToCyrillic)).toEqual({
      type: "essay",
      title: "Шаҳар",
      sections: [{ id: "s1", heading: "Кириш", paragraphs: ["Салом"] }],
    });
  });
});
