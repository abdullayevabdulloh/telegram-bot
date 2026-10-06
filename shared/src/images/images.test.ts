import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocumentContent } from "../schema";
import { attachImages, imageSize } from "./index";

const deck: DocumentContent = {
  type: "presentation",
  title: "Tabiat",
  coverImageQuery: "mountain lake",
  sections: [
    { id: "s1", heading: "Kirish", bullets: ["Bir"], layout: "bullets" },
    { id: "s2", heading: "Tog‘lar", bullets: ["Ikki"], layout: "image", imageQuery: "mountains" },
    { id: "s3", heading: "Ko‘llar", bullets: ["Uch"], layout: "image", imageQuery: "mountains" },
  ],
};

const photo = (id: number) => ({
  id,
  width: 4000,
  height: 3000,
  photographer: `Author ${id}`,
  avg_color: "#336699",
  src: { large2x: `https://images.pexels.com/photos/${id}.jpeg` },
});

describe("imageSize", () => {
  it("reads PNG and JPEG headers", () => {
    const png = Buffer.alloc(32);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    expect(imageSize(png)).toEqual({ width: 640, height: 480, mime: "image/png" });

    // SOI, then an SOF0 segment: length, precision, height, width
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0, 0, 0, 0, 0, 0]);
    expect(imageSize(jpeg)).toEqual({ width: 640, height: 480, mime: "image/jpeg" });
    expect(imageSize(Buffer.from("GIF89a"))).toBeNull();
  });
});

describe("attachImages", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does nothing without an API key", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await attachImages(deck, undefined)).toBe(deck);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("adds a unique photo to the cover and every image slide", async () => {
    const fetch = vi.fn(async () => Response.json({ photos: [photo(1), photo(2), photo(3)] }));
    vi.stubGlobal("fetch", fetch);
    const result = await attachImages(deck, "key");
    expect(result.coverImage).toMatchObject({ url: "https://images.pexels.com/photos/1.jpeg", width: 1880, height: 1410, credit: "Author 1" });
    expect(result.sections[0]!.image).toBeUndefined();
    // Same query on two slides still gives two different photos
    expect(result.sections[1]!.image?.url).toBe("https://images.pexels.com/photos/2.jpeg");
    expect(result.sections[2]!.image?.url).toBe("https://images.pexels.com/photos/3.jpeg");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("keeps the slides when Pexels fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const result = await attachImages(deck, "key");
    expect(result.coverImage).toBeUndefined();
    expect(result.sections.every((s) => !s.image)).toBe(true);
  });
});
