import type { TemplateId } from "../schema";

export interface Template {
  id: TemplateId;
  name: string;
  proOnly: boolean;
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
    proOnly: false,
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
    proOnly: false,
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
    proOnly: true,
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
