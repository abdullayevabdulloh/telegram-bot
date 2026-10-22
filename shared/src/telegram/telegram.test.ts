import { describe, expect, it } from "vitest";
import type { DocumentContent } from "../schema";
import { documentMessages, doneText, resultKeyboard, retryKeyboard, splitForTelegram } from "./index";

// Visible length of an HTML message, as Telegram counts it
const visible = (html: string) => html.replace(/<\/?b>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").length;

const report: DocumentContent = {
  type: "report",
  title: "AI <ta’limda> & jamiyatda",
  plan: ["Kirish", "1. Asos", "Xulosa"],
  sections: [
    { id: "s1", heading: "Kirish", paragraphs: ["Birinchi abzats.", "Ikkinchi abzats."] },
    { id: "s2", heading: "1. Asos", paragraphs: Array.from({ length: 12 }, (_, i) => `${i + 1}-abzats. ${"So‘z ".repeat(80)}`) },
    { id: "s3", heading: "Xulosa", paragraphs: ["Yakun."] },
  ],
  references: ["Muallif A. Kitob. — Toshkent: Fan, 2020."],
};

describe("splitForTelegram", () => {
  it("keeps short blocks in one message, in order", () => {
    expect(splitForTelegram([{ text: "Sarlavha", bold: true }, { text: "Matn" }])).toEqual(["<b>Sarlavha</b>\n\nMatn"]);
  });

  it("never exceeds the limit and splits long paragraphs at sentences", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Gap ${i + 1} biroz uzunroq matndan iborat.`).join(" ");
    const messages = splitForTelegram([{ text: long }], 300);
    expect(messages.length).toBeGreaterThan(1);
    for (const m of messages) {
      expect(visible(m)).toBeLessThanOrEqual(300);
      expect(m.endsWith(".")).toBe(true);
    }
    expect(messages.join(" ")).toBe(long);
  });

  it("cuts a text without spaces anywhere", () => {
    const messages = splitForTelegram([{ text: "x".repeat(250) }], 100);
    expect(messages.map((m) => m.length)).toEqual([100, 100, 50]);
  });

  it("escapes HTML in every piece", () => {
    expect(splitForTelegram([{ text: "<b>&</b>", bold: true }])).toEqual(["<b>&lt;b&gt;&amp;&lt;/b&gt;</b>"]);
  });
});

describe("documentMessages", () => {
  it("sends the whole report in order within Telegram limits", () => {
    const messages = documentMessages(report, "uz-latn", "uz-latn");
    expect(messages.length).toBeGreaterThan(1);
    for (const m of messages) expect(visible(m)).toBeLessThanOrEqual(3500);
    const all = messages.join("\n\n");
    expect(all.startsWith("<b>AI &lt;ta’limda&gt; &amp; jamiyatda</b>")).toBe(true);
    const order = ["Kirish", "1. Asos", "12-abzats", "Xulosa", "Foydalanilgan adabiyotlar", "1. Muallif A.", "Topshirishdan oldin"];
    const positions = order.map((s) => all.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe("result texts and keyboards", () => {
  it("warns about references and offers the text for a report", () => {
    const generation = { id: "a".repeat(24), type: "report" as const, language: "uz-latn" as const, content: report };
    expect(doneText(generation, "uz-latn")).toContain("Adabiyotlar ro‘yxatini albatta tekshiring");
    const data = resultKeyboard(generation, "uz-latn").inline_keyboard.flat().map((b) => (b as { callback_data: string }).callback_data);
    expect(data).toEqual([`exp:docx:${generation.id}`, `exp:pdf:${generation.id}`, `cv:${generation.id}`, `txt:${generation.id}`, `rg:${generation.id}`]);
  });

  it("offers a retry after a failure", () => {
    expect(retryKeyboard("b".repeat(24), "ru").inline_keyboard).toEqual([[{ text: "🔁 Попробовать снова", callback_data: `rg:${"b".repeat(24)}` }]]);
  });
});
