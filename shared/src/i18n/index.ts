import type { Language, UiLanguage } from "../schema";
import { latinToCyrillic } from "../translit";
import { ru } from "./locales/ru";
import { uzLatn, type MessageKey, type Messages } from "./locales/uz-latn";

export type { MessageKey, Messages };

let uzCyrl: Messages | undefined;

function messages(lang: UiLanguage): Messages {
  if (lang === "ru") return ru;
  if (lang === "uz-cyrl") {
    uzCyrl ??= Object.fromEntries(Object.entries(uzLatn).map(([k, v]) => [k, latinToCyrillic(v)])) as Messages;
    return uzCyrl;
  }
  return uzLatn;
}

export type Params = Record<string, string | number>;

export function t(lang: UiLanguage, key: MessageKey, params?: Params): string {
  const template = messages(lang)[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Every translation of a key — used to recognise reply-keyboard buttons in any UI language. */
export function allTranslations(key: MessageKey): string[] {
  return [...new Set((["uz-latn", "uz-cyrl", "ru"] as const).map((lang) => t(lang, key)))];
}

/** Language names are shown in their own script regardless of the UI language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  "uz-latn": "O‘zbekcha (lotin)",
  "uz-cyrl": "Ўзбекча (кирилл)",
  ru: "Русский",
  en: "English",
};

/** Telegram language_code → default UI language. */
export function uiLanguageFromTelegram(code: string | undefined): UiLanguage {
  return code?.startsWith("ru") ? "ru" : "uz-latn";
}

// ------------------------------------------------------------ strings inside documents

const DOC_UZ_LATN = {
  plan: "Reja",
  introduction: "Kirish",
  conclusion: "Xulosa",
  references: "Foydalanilgan adabiyotlar",
  thanks: "E’tiboringiz uchun rahmat!",
  essay: "ESSE",
  work: "MUSTAQIL ISH",
  topic: "Mavzu",
  subject: "Fan",
  faculty: "Fakultet",
  performedBy: "Bajardi",
  checkedBy: "Tekshirdi",
  group: "Guruh",
  photo: "Foto",
};

export type DocStrings = typeof DOC_UZ_LATN;

const DOC_STRINGS: Record<Exclude<Language, "uz-cyrl">, DocStrings> = {
  "uz-latn": DOC_UZ_LATN,
  ru: {
    plan: "План",
    introduction: "Введение",
    conclusion: "Заключение",
    references: "Список литературы",
    thanks: "Спасибо за внимание!",
    essay: "ЭССЕ",
    work: "САМОСТОЯТЕЛЬНАЯ РАБОТА",
    topic: "Тема",
    subject: "Предмет",
    faculty: "Факультет",
    performedBy: "Выполнил(а)",
    checkedBy: "Проверил(а)",
    group: "Группа",
    photo: "Фото",
  },
  en: {
    plan: "Outline",
    introduction: "Introduction",
    conclusion: "Conclusion",
    references: "References",
    thanks: "Thank you for your attention!",
    essay: "ESSAY",
    work: "INDEPENDENT WORK",
    topic: "Topic",
    subject: "Subject",
    faculty: "Faculty",
    performedBy: "Prepared by",
    checkedBy: "Checked by",
    group: "Group",
    photo: "Photo",
  },
};

export function docStrings(lang: Language): DocStrings {
  if (lang === "uz-cyrl") {
    return Object.fromEntries(Object.entries(DOC_UZ_LATN).map(([k, v]) => [k, latinToCyrillic(v)])) as DocStrings;
  }
  return DOC_STRINGS[lang];
}
