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
}

/** Blends two #RRGGBB colors: amount 0 → a, 1 → b. */
export function mix(a: string, b: string, amount: number): string {
  const channel = (color: string, i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Template sets the style (light, minimal, dark); the topic theme sets the colors. */
export function slideColors(template: TemplateId, theme?: SlideTheme): SlideColors {
  if (!theme) return { ...templates[template].screen, onPrimary: "#FFFFFF" };
  const p = palettes[theme];
  switch (template) {
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
