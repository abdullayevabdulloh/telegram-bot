import { config } from "../config";
import { logger } from "../logger";
import type { DocumentContent, SlideImage } from "../schema";

const SEARCH_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  avg_color: string | null;
  src: { large2x: string };
}

/** First landscape photo for the query that is not in `used`; null when nothing fits or Pexels fails. */
async function searchPhoto(apiKey: string, query: string, used: Set<number>): Promise<SlideImage | null> {
  const url = new URL("https://api.pexels.com/v1/search");
  url.search = new URLSearchParams({ query, orientation: "landscape", per_page: "8" }).toString();
  try {
    const response = await fetch(url, { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
    if (!response.ok) {
      logger.warn({ status: response.status, query }, "Pexels search failed");
      return null;
    }
    const { photos } = (await response.json()) as { photos: PexelsPhoto[] };
    const photo = photos.find((p) => !used.has(p.id));
    if (!photo) return null;
    used.add(photo.id);
    // large2x is 940px wide at 2x density; keep the original aspect ratio for cropping.
    const width = 1880;
    return {
      url: photo.src.large2x,
      width,
      height: Math.round((width * photo.height) / photo.width),
      credit: photo.photographer,
      color: photo.avg_color ?? undefined,
    };
  } catch (error) {
    logger.warn({ err: (error as Error).message, query }, "Pexels search failed");
    return null;
  }
}

/**
 * Finds stock photos for the cover and the "image" slides of a presentation.
 * Best effort: without PEXELS_API_KEY, or when a search fails, slides are drawn without photos.
 */
export async function attachImages(content: DocumentContent, apiKey = config.PEXELS_API_KEY): Promise<DocumentContent> {
  if (content.type !== "presentation" || !apiKey) return content;
  const used = new Set<number>();
  const coverImage = content.coverImageQuery ? await searchPhoto(apiKey, content.coverImageQuery, used) : null;
  // Sequential on purpose: keeps photos unique across slides and stays far below the rate limit.
  const sections = [];
  for (const section of content.sections) {
    const image = section.layout === "image" && section.imageQuery ? await searchPhoto(apiKey, section.imageQuery, used) : null;
    sections.push(image ? { ...section, image } : section);
  }
  return { ...content, sections, ...(coverImage ? { coverImage } : {}) };
}

// ------------------------------------------------------------------ downloads for export

export interface LoadedImage {
  data: Buffer;
  /** Pixel size read from the file itself. */
  width: number;
  height: number;
  mime: "image/jpeg" | "image/png";
}

/** Recent downloads, so exporting the same deck to PPTX and PDF fetches each photo once. */
const cache = new Map<string, LoadedImage>();
const CACHE_LIMIT = 60;

/** Pixel size of a JPEG or PNG, or null for anything else. */
export function imageSize(data: Buffer): { width: number; height: number; mime: LoadedImage["mime"] } | null {
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), mime: "image/png" };
  }
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1]!;
      const length = data.readUInt16BE(offset + 2);
      // SOF0–SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7), mime: "image/jpeg" };
      }
      offset += 2 + length;
    }
  }
  return null;
}

async function download(url: string): Promise<LoadedImage | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    const size = imageSize(data);
    if (!size) throw new Error("not a JPEG or PNG");
    const image = { data, ...size };
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(url, image);
    return image;
  } catch (error) {
    logger.warn({ err: (error as Error).message, url }, "Image download failed");
    return null;
  }
}

/** Downloads every photo of a deck; a photo that fails is left out and its slide is drawn without it. */
export async function loadImages(content: DocumentContent): Promise<Map<string, LoadedImage>> {
  const urls = [content.coverImage?.url, ...content.sections.map((s) => s.image?.url)].filter((u): u is string => Boolean(u));
  const images = new Map<string, LoadedImage>();
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      const image = await download(url);
      if (image) images.set(url, image);
    }),
  );
  return images;
}
