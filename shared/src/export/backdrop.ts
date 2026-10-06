import { crc32, deflateSync } from "node:zlib";
import type { LoadedImage } from "../images";
import type { Backdrop } from "../templates";

// Small on purpose: renderers stretch it over the slide, and a smooth gradient has no detail to lose.
const WIDTH = 480;
const HEIGHT = 270;

const channels = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];

// 4×4 ordered dither, in fractions of one color step: hides 8-bit banding in wide, slow gradients
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

/**
 * Paints the base color with soft radial glows and encodes it as an RGB PNG. Both PPTX and PDF
 * can show an image, while neither has gradients the other one can reproduce.
 */
export function renderBackdrop({ base, glows }: Backdrop): LoadedImage {
  const stride = WIDTH * 3 + 1; // filter byte + RGB pixels
  const raw = Buffer.alloc(stride * HEIGHT);
  const [baseR, baseG, baseB] = channels(base);
  // Gaussian falloff: at distance r the glow is down to e^-3 ≈ 5%
  const tints = glows.map((glow) => ({ ...glow, rgb: channels(glow.color), falloff: -3 / (glow.r * glow.r) }));
  const byte = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

  for (let py = 0; py < HEIGHT; py++) {
    const row = py * stride;
    raw[row] = 1; // "Sub" filter: each byte minus its left neighbour, mostly zeros for a gradient
    let leftR = 0;
    let leftG = 0;
    let leftB = 0;
    for (let px = 0; px < WIDTH; px++) {
      let r = baseR;
      let g = baseG;
      let b = baseB;
      for (const tint of tints) {
        // Distances in slide widths keep the glows round on the 16:9 slide
        const dx = px / WIDTH - tint.x;
        const dy = ((py / HEIGHT - tint.y) * HEIGHT) / WIDTH;
        const amount = tint.strength * Math.exp(tint.falloff * (dx * dx + dy * dy));
        r += (tint.rgb[0] - r) * amount;
        g += (tint.rgb[1] - g) * amount;
        b += (tint.rgb[2] - b) * amount;
      }
      const dither = BAYER[(py % 4) * 4 + (px % 4)]!;
      const [outR, outG, outB] = [byte(r + dither), byte(g + dither), byte(b + dither)];
      const at = row + 1 + px * 3;
      raw[at] = (outR - leftR) & 0xff;
      raw[at + 1] = (outG - leftG) & 0xff;
      raw[at + 2] = (outB - leftB) & 0xff;
      leftR = outR;
      leftG = outG;
      leftB = outB;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, deflate, standard filters, no interlace
  const data = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 6 })), // level 9 is ~10× slower for ~15% less
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return { data, width: WIDTH, height: HEIGHT, mime: "image/png" };
}

/** PNG chunk: length, type, body, CRC of type + body. */
function chunk(type: string, body: Buffer): Buffer {
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const out = Buffer.alloc(typed.length + 8);
  out.writeUInt32BE(body.length, 0);
  typed.copy(out, 4);
  out.writeUInt32BE(crc32(typed), typed.length + 4);
  return out;
}
