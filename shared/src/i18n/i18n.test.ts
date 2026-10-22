import { describe, expect, it } from "vitest";
import { allTranslations, docStrings, t } from "./index";
import { ru } from "./locales/ru";
import { uzLatn } from "./locales/uz-latn";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?[a-z]+>/g)].map((m) => m[0]).sort();
const commands = (s: string) => [...s.matchAll(/\/[a-z]+/g)].map((m) => m[0]).sort();

describe("i18n", () => {
  it("ru has the same placeholders and HTML tags as uz-latn", () => {
    for (const key of Object.keys(uzLatn) as (keyof typeof uzLatn)[]) {
      expect(placeholders(ru[key]), key).toEqual(placeholders(uzLatn[key]));
      expect(tags(ru[key]), key).toEqual(tags(uzLatn[key]));
    }
  });

  it("uz-cyrl keeps placeholders, HTML tags and commands", () => {
    for (const key of Object.keys(uzLatn) as (keyof typeof uzLatn)[]) {
      const cyrl = t("uz-cyrl", key);
      expect(placeholders(cyrl), key).toEqual(placeholders(uzLatn[key]));
      expect(tags(cyrl), key).toEqual(tags(uzLatn[key]));
      expect(commands(cyrl), key).toEqual(commands(uzLatn[key]));
    }
    expect(t("uz-cyrl", "menu.new")).toBe("📝 Янги ҳужжат");
  });

  it("fills params", () => {
    expect(t("uz-latn", "unit.slides", { n: 10 })).toBe("10 slayd");
    expect(t("uz-cyrl", "stage.chapter", { n: 2, total: 4 })).toBe("2/4-боб ёзилмоқда");
  });

  it("lists reply-keyboard texts for every UI language", () => {
    expect(allTranslations("menu.new")).toEqual(["📝 Yangi hujjat", "📝 Янги ҳужжат", "📝 Новый документ"]);
    expect(allTranslations("menu.report")).toEqual(["🎤 Doklad yaratish", "🎤 Доклад яратиш", "🎤 Создать доклад"]);
  });

  it("derives document strings for Cyrillic Uzbek", () => {
    expect(docStrings("uz-cyrl").references).toBe("Фойдаланилган адабиётлар");
    expect([docStrings("uz-latn").report, docStrings("uz-cyrl").report, docStrings("en").report]).toEqual(["DOKLAD", "ДОКЛАД", "REPORT"]);
  });
});
