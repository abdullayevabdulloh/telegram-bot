import type { SlideTheme, TemplateId } from "../schema";

export interface Template {
  id: TemplateId;
  name: string;
  /** Colors for screens: web preview, slides (PPTX and slide PDF). */
  screen: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    primary: string;
    accent: string;
    coverBg: string;
    coverText: string;
  };
  /** Colors for printed A4 documents (DOCX and essay/work PDF) — always on white paper. */
  print: {
    heading: string;
    accent: string;
    text: string;
    muted: string;
  };
  /** Web fonts (preview). PDF embeds Noto Sans; Office files reference `office` fonts by name. */
  fonts: { heading: string; body: string };
  office: { heading: string; body: string };
  /** Palette for decks without a topic theme; gradient templates need one to paint their backdrop. */
  theme?: SlideTheme;
}

export const templates: Record<TemplateId, Template> = {
  modern: {
    id: "modern",
    name: "Modern",
    screen: {
      bg: "#FFFFFF",
      surface: "#EEF2FF",
      text: "#111827",
      muted: "#6B7280",
      primary: "#4F46E5",
      accent: "#F59E0B",
      coverBg: "#4F46E5",
      coverText: "#FFFFFF",
    },
    print: { heading: "#4F46E5", accent: "#F59E0B", text: "#111827", muted: "#6B7280" },
    fonts: { heading: "Montserrat", body: "Inter" },
    office: { heading: "Calibri", body: "Calibri" },
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    screen: {
      bg: "#FFFFFF",
      surface: "#F3F4F6",
      text: "#111827",
      muted: "#6B7280",
      primary: "#111827",
      accent: "#6B7280",
      coverBg: "#FFFFFF",
      coverText: "#111827",
    },
    print: { heading: "#111827", accent: "#6B7280", text: "#111827", muted: "#6B7280" },
    fonts: { heading: "Inter", body: "Inter" },
    office: { heading: "Arial", body: "Arial" },
  },
  dark: {
    id: "dark",
    name: "Dark",
    screen: {
      bg: "#0F172A",
      surface: "#1E293B",
      text: "#E2E8F0",
      muted: "#94A3B8",
      primary: "#38BDF8",
      accent: "#F472B6",
      coverBg: "#0F172A",
      coverText: "#F8FAFC",
    },
    print: { heading: "#0369A1", accent: "#DB2777", text: "#111827", muted: "#6B7280" },
    fonts: { heading: "Montserrat", body: "Inter" },
    office: { heading: "Calibri", body: "Calibri" },
  },
  aurora: {
    id: "aurora",
    name: "Aurora",
    screen: {
      bg: "#0B1026",
      surface: "#1A1F38",
      text: "#E5E7EB",
      muted: "#A1A7B3",
      primary: "#818CF8",
      accent: "#06B6D4",
      coverBg: "#0B1026",
      coverText: "#FFFFFF",
    },
    print: { heading: "#4338CA", accent: "#0891B2", text: "#111827", muted: "#6B7280" },
    fonts: { heading: "Montserrat", body: "Inter" },
    office: { heading: "Calibri", body: "Calibri" },
    theme: "technology",
  },
  pastel: {
    id: "pastel",
    name: "Pastel",
    screen: {
      bg: "#FDF8FD",
      surface: "#FFFFFF",
      text: "#1F2937",
      muted: "#6B7280",
      primary: "#C026D3",
      accent: "#F97316",
      coverBg: "#FDF8FD",
      coverText: "#111827",
    },
    print: { heading: "#A21CAF", accent: "#EA580C", text: "#111827", muted: "#6B7280" },
    fonts: { heading: "Poppins", body: "Inter" },
    office: { heading: "Calibri", body: "Calibri" },
    theme: "art",
  },
};

export function getTemplate(id: TemplateId): Template {
  return templates[id];
}

// ------------------------------------------------------------ topic palettes for slides

interface Palette {
  primary: string;
  accent: string;
  /** Light tint of primary for cards on white slides. */
  tint: string;
  /** Deep background for the Dark template. */
  deep: string;
  /** Primary that stays readable on the deep background. */
  bright: string;
}

/** Picked by the AI from the topic, so a history deck does not look like a tech deck. */
export const palettes: Record<SlideTheme, Palette> = {
  technology: { primary: "#4F46E5", accent: "#06B6D4", tint: "#EEF0FF", deep: "#0B1026", bright: "#818CF8" },
  science: { primary: "#7C3AED", accent: "#14B8A6", tint: "#F4EEFF", deep: "#130B26", bright: "#A78BFA" },
  nature: { primary: "#15803D", accent: "#EAB308", tint: "#EAF7EE", deep: "#08190F", bright: "#4ADE80" },
  medicine: { primary: "#0E7490", accent: "#F43F5E", tint: "#E6F5F8", deep: "#061A20", bright: "#22D3EE" },
  history: { primary: "#9F1239", accent: "#C8962E", tint: "#FBF0F2", deep: "#1C080D", bright: "#FB7185" },
  business: { primary: "#1E3A8A", accent: "#F59E0B", tint: "#EDF2FB", deep: "#0A132E", bright: "#60A5FA" },
  education: { primary: "#2563EB", accent: "#F97316", tint: "#EEF4FF", deep: "#0A1530", bright: "#60A5FA" },
  art: { primary: "#C026D3", accent: "#F97316", tint: "#FBEFFC", deep: "#1E0921", bright: "#E879F9" },
  law: { primary: "#334155", accent: "#B7862B", tint: "#F1F4F8", deep: "#0E141F", bright: "#94A3B8" },
  sport: { primary: "#DC2626", accent: "#0EA5E9", tint: "#FDF0F0", deep: "#1F0A0A", bright: "#F87171" },
  geography: { primary: "#0369A1", accent: "#10B981", tint: "#E9F5FC", deep: "#05182A", bright: "#38BDF8" },
  society: { primary: "#B45309", accent: "#0D9488", tint: "#FCF4EA", deep: "#1E1306", bright: "#FBBF24" },
};

/** A soft radial glow of a backdrop: center as fractions of the slide size, radius as a fraction of its width. */
export interface Glow {
  x: number;
  y: number;
  r: number;
  color: string;
  /** 0–1: how much of the glow color shows at its center. */
  strength: number;
}

/** Gradient painted behind a slide: a base color with glows over it. */
export interface Backdrop {
  base: string;
  glows: Glow[];
}

export interface SlideColors {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  coverBg: string;
  coverText: string;
  /** Text on primary-colored panels. */
  onPrimary: string;
  /** Gradient templates: a calm backdrop for content slides, a vivid one for the cover, closing and highlight slides. */
  backdrop?: { soft: Backdrop; vivid: Backdrop };
  /** Gradient templates draw translucent "glass" panels with a light edge instead of solid `surface` ones. */
  glass?: { fill: string; opacity: number; edge: string; edgeOpacity: number };
}

/** Blends two #RRGGBB colors: amount 0 → a, 1 → b. */
export function mix(a: string, b: string, amount: number): string {
  const channel = (color: string, i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Template sets the style (light, minimal, dark, gradient); the topic theme sets the colors. */
export function slideColors(template: TemplateId, theme = templates[template].theme): SlideColors {
  if (!theme) return { ...templates[template].screen, onPrimary: "#FFFFFF" };
  const p = palettes[theme];
  switch (template) {
    case "aurora":
      return {
        bg: p.deep, surface: mix(p.deep, "#FFFFFF", 0.08), text: "#E5E7EB", muted: "#A1A7B3", primary: p.bright, accent: p.accent,
        coverBg: p.deep, coverText: "#FFFFFF", onPrimary: p.deep,
        backdrop: {
          soft: {
            base: p.deep,
            glows: [
              { x: 1, y: 0, r: 0.5, color: p.primary, strength: 0.65 },
              { x: 0, y: 1, r: 0.42, color: p.accent, strength: 0.3 },
            ],
          },
          vivid: {
            base: p.deep,
            glows: [
              { x: 0.88, y: 0.08, r: 0.7, color: p.primary, strength: 0.95 },
              { x: 0.08, y: 0.95, r: 0.58, color: p.accent, strength: 0.75 },
              { x: 0.58, y: 0.6, r: 0.36, color: p.bright, strength: 0.4 },
            ],
          },
        },
        glass: { fill: "#FFFFFF", opacity: 0.07, edge: "#FFFFFF", edgeOpacity: 0.16 },
      };
    case "pastel": {
      const base = mix(p.tint, "#FFFFFF", 0.4);
      const pale = (color: string, amount: number) => mix(color, "#FFFFFF", amount);
      return {
        bg: base, surface: "#FFFFFF", text: "#1F2937", muted: "#6B7280", primary: p.primary, accent: p.accent,
        coverBg: base, coverText: "#111827", onPrimary: "#FFFFFF",
        backdrop: {
          soft: {
            base,
            glows: [
              { x: 1, y: 0, r: 0.55, color: pale(p.primary, 0.7), strength: 0.85 },
              { x: 0, y: 1, r: 0.5, color: pale(p.accent, 0.65), strength: 0.75 },
            ],
          },
          vivid: {
            base,
            glows: [
              { x: 0.9, y: 0.05, r: 0.72, color: pale(p.primary, 0.45), strength: 1 },
              { x: 0.05, y: 0.95, r: 0.62, color: pale(p.accent, 0.4), strength: 0.95 },
              { x: 0.5, y: 0.5, r: 0.34, color: pale(p.bright, 0.55), strength: 0.55 },
            ],
          },
        },
        glass: { fill: "#FFFFFF", opacity: 0.62, edge: "#FFFFFF", edgeOpacity: 0.9 },
      };
    }
    case "dark":
      return {
        bg: p.deep, surface: mix(p.deep, "#FFFFFF", 0.08), text: "#E5E7EB", muted: "#9CA3AF", primary: p.bright, accent: p.accent,
        coverBg: p.deep, coverText: "#FFFFFF", onPrimary: p.deep,
      };
    case "minimal":
      return {
        bg: "#FFFFFF", surface: "#F4F4F5", text: "#18181B", muted: "#71717A", primary: "#18181B", accent: p.primary,
        coverBg: "#FFFFFF", coverText: "#18181B", onPrimary: "#FFFFFF",
      };
    default:
      return {
        bg: "#FFFFFF", surface: p.tint, text: "#111827", muted: "#6B7280", primary: p.primary, accent: p.accent,
        coverBg: p.primary, coverText: "#FFFFFF", onPrimary: "#FFFFFF",
      };
  }
}
