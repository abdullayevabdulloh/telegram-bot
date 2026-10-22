import { describe, expect, it } from "vitest";
import { DocTypeSchema, FORMATS_BY_TYPE, hasTitlePage, LENGTH_RULES, parseTitleMeta, TopicSchema } from "./index";

describe("report type", () => {
  it("is a document type with its own size and formats", () => {
    expect(DocTypeSchema.parse("report")).toBe("report");
    expect(LENGTH_RULES.report).toMatchObject({ unit: "pages", default: 5, min: 3, max: 10, presets: [3, 5, 7, 10] });
    expect(FORMATS_BY_TYPE.report).toEqual(["docx", "pdf"]);
  });

  it("has a title page like an independent work", () => {
    expect(["essay", "presentation", "work", "report"].filter((t) => hasTitlePage(t as never))).toEqual(["work", "report"]);
  });
});

describe("TopicSchema", () => {
  it("accepts a normal topic and collapses whitespace", () => {
    expect(TopicSchema.parse("  AI   ta’limda \n")).toBe("AI ta’limda");
    expect(TopicSchema.parse("Sun’iy intellektning ta’limdagi o‘rni")).toBe("Sun’iy intellektning ta’limdagi o‘rni");
  });

  it("rejects empty, too short, too long and symbol-only topics", () => {
    for (const topic of ["", "   ", "ab", "!!!", "😀😀😀", "?! …", "a".repeat(201)]) {
      expect(TopicSchema.safeParse(topic).success, topic).toBe(false);
    }
  });
});

describe("parseTitleMeta", () => {
  it("drops control characters from values", () => {
    expect(parseTitleMeta("OTM: TDIU\u0007\nGuruh:\tIQ-21")).toEqual({ university: "TDIU", group: "IQ-21" });
  });
});
