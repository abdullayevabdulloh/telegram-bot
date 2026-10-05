/**
 * Uzbek Latin ↔ Cyrillic transliteration (rule based, no AI).
 * Pure TypeScript — runs in Node and in the browser.
 *
 * Output Latin uses ‘ (U+2018) for o‘/g‘ and ’ (U+2019) for the tutuq belgisi:
 * these are present in every common font, unlike ʻ/ʼ.
 */

export type Script = "latin" | "cyrillic";

export const OKINA = "‘"; // o‘, g‘
export const TUTUQ = "’"; // ma’no

const APOSTROPHES = "ʻʼ‘’'`´";
const isApostrophe = (c: string | undefined) => c !== undefined && APOSTROPHES.includes(c);
const isLetter = (c: string | undefined) => c !== undefined && /\p{L}/u.test(c);
const isUpper = (c: string) => c !== c.toLowerCase() && c === c.toUpperCase();

const LATIN_VOWELS = new Set(["a", "e", "i", "o", "u"]);
const CYRILLIC_VOWELS = new Set([..."аеёиоуэюяўы"]);

const LATIN_SINGLE: Record<string, string> = {
  a: "а", b: "б", c: "ц", d: "д", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л",
  m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в",
  x: "х", y: "й", z: "з",
};

const CYRILLIC_SINGLE: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x",
  ч: "ch", ш: "sh", щ: "sh", ы: "i", э: "e", ю: "yu", я: "ya", ў: `o${OKINA}`, қ: "q",
  ғ: `g${OKINA}`, ҳ: "h", ъ: TUTUQ, ь: "",
};

/**
 * Russian loanwords whose spelling cannot be derived by rules (ц, ь, я are lost in Latin).
 * [latin, cyrillic]. Keys of 5+ letters also match as a stem ("sentabrda" → "сентябрда").
 */
const EXCEPTIONS: [string, string][] = [
  ["yanvar", "январь"],
  ["fevral", "февраль"],
  ["aprel", "апрель"],
  ["iyun", "июнь"],
  ["iyul", "июль"],
  ["sentabr", "сентябрь"],
  ["oktabr", "октябрь"],
  ["noyabr", "ноябрь"],
  ["dekabr", "декабрь"],
  ["sirk", "цирк"],
  ["konsert", "концерт"],
  ["sement", "цемент"],
  ["stansiya", "станция"],
  ["konferensiya", "конференция"],
  ["tendensiya", "тенденция"],
  ["kompetensiya", "компетенция"],
  ["revolyutsiya", "революция"],
  ["kompyuter", "компьютер"],
  ["fakultet", "факультет"],
  ["rol", "роль"],
  ["model", "модель"],
  ["avtomobil", "автомобиль"],
];

const STEM_MIN = 5;
const LAT_EXACT = new Map(EXCEPTIONS.map(([l, c]) => [l, c]));
const CYR_EXACT = new Map(EXCEPTIONS.map(([l, c]) => [c, l]));
const LAT_STEMS = EXCEPTIONS.filter(([l]) => l.length >= STEM_MIN).sort((a, b) => b[0].length - a[0].length);
const CYR_STEMS = EXCEPTIONS.map(([l, c]) => [l, c.replace(/ь$/, "")] as const)
  .filter(([, c]) => c.length >= STEM_MIN)
  .sort((a, b) => b[1].length - a[1].length);

/** Latin tokens that stay Latin inside Cyrillic text (case-sensitive: "IT" stays, "it" (dog) converts). */
const KEEP_LATIN = new Set([
  "AI", "IT", "PDF", "DOCX", "PPTX", "HTML", "CSS", "URL", "USB", "SMS", "GPS", "Wi-Fi",
  "Python", "JavaScript", "TypeScript", "Java", "OpenAI", "ChatGPT", "Google", "Microsoft",
  "Windows", "Linux", "Android", "iOS", "iPhone", "YouTube", "Excel", "Word", "PowerPoint",
  "EduGen", "Free", "Pro", "Modern", "Minimal", "Dark",
]);

// URLs, e-mails, {placeholders}, HTML tags and /commands are never converted.
const PROTECTED =
  /(https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.-]+|\{[^{}]*\}|<\/?[a-z][^<>]*>|(?<![\p{L}\d])\/[a-z][a-z_]*)/gu;
const WORD = new RegExp(`[\\p{L}${APOSTROPHES}]+(?:-[\\p{L}${APOSTROPHES}]+)*`, "gu");

function applyCase(source: string, target: string): string {
  if (!target) return target;
  return isUpper(source) ? target[0]!.toUpperCase() + target.slice(1) : target;
}

function isAllCaps(word: string): boolean {
  const letters = [...word].filter((c) => isLetter(c));
  return letters.length > 1 && letters.every(isUpper);
}

function mapWords(text: string, convertWord: (word: string) => string): string {
  return text
    .split(PROTECTED)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(WORD, convertWord)))
    .join("");
}

// ---------------------------------------------------------------- Latin → Cyrillic

function startsWithAt(chars: string[], index: number, lower: string): boolean {
  return chars.slice(index, index + lower.length).join("").toLowerCase() === lower;
}

function latinWordToCyrillic(word: string, prevSource = ""): string {
  const chars = [...word];
  let out = "";
  let prev = prevSource; // previous source letter (lowercase), for the e/э rule

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const lc = c.toLowerCase();
    const next = chars[i + 1];
    const nextLc = next?.toLowerCase();

    if (isApostrophe(c)) {
      const before = chars[i - 1]?.toLowerCase();
      const between = isLetter(chars[i - 1]) && isLetter(next);
      if (before === "s" && nextLc === "h") {
        // s’h — the apostrophe only separates с and ҳ
      } else if (between) {
        out += isAllCaps(word) ? "Ъ" : "ъ";
      } else {
        out += c; // quotation mark
      }
      continue;
    }

    let mapped: string | undefined;
    let consumed = 1;

    if ((lc === "o" || lc === "g") && isApostrophe(next)) {
      mapped = lc === "o" ? "ў" : "ғ";
      consumed = 2;
    } else if (lc === "s" && nextLc === "h") {
      mapped = "ш";
      consumed = 2;
    } else if (lc === "t" && nextLc === "s" && startsWithAt(chars, i + 2, "iya")) {
      mapped = "ц"; // militsiya → милиция (native Uzbek has no "-tsiya")
      consumed = 2;
    } else if (lc === "s" && prev === "k" && startsWithAt(chars, i + 1, "iya")) {
      mapped = "ц"; // aksiya, funksiya, reaksiya → -кция
    } else if (lc === "c" && nextLc === "h") {
      mapped = "ч";
      consumed = 2;
    } else if (lc === "y" && nextLc === "o" && !isApostrophe(chars[i + 2])) {
      mapped = "ё";
      consumed = 2;
    } else if (lc === "y" && nextLc === "u") {
      mapped = "ю";
      consumed = 2;
    } else if (lc === "y" && nextLc === "a") {
      mapped = "я";
      consumed = 2;
    } else if (lc === "y" && nextLc === "e") {
      mapped = "е";
      consumed = 2;
    } else if (lc === "e") {
      mapped = prev === "" || LATIN_VOWELS.has(prev) ? "э" : "е";
    } else {
      mapped = LATIN_SINGLE[lc];
    }

    if (mapped === undefined) {
      out += c; // digits, Cyrillic, other letters pass through
      prev = isLetter(c) ? lc : ""; // after "-" a new word part starts
      continue;
    }

    out += isUpper(c) ? mapped.toUpperCase() : mapped;
    // o‘ is a vowel and g‘ a consonant — the apostrophe itself must not be "previous"
    prev = consumed === 2 && isApostrophe(next) ? lc : chars[i + consumed - 1]!.toLowerCase();
    i += consumed - 1;
  }
  return out;
}

function latinWordWithExceptions(word: string): string {
  if (KEEP_LATIN.has(word)) return word;
  const lower = word.toLowerCase();
  const allCaps = isAllCaps(word);
  const finish = (s: string) => (allCaps ? s.toUpperCase() : applyCase(word, s));

  const exact = LAT_EXACT.get(lower);
  if (exact) return finish(exact);

  for (const [lat, cyr] of LAT_STEMS) {
    if (lower.startsWith(lat) && lower.length > lat.length) {
      const stem = cyr.replace(/ь$/, "");
      const rest = latinWordToCyrillic(word.slice(lat.length), lat.at(-1));
      return finish(stem) + rest;
    }
  }
  return latinWordToCyrillic(word);
}

export function latinToCyrillic(text: string): string {
  return mapWords(text, latinWordWithExceptions);
}

// ---------------------------------------------------------------- Cyrillic → Latin

function cyrillicWordToLatin(word: string, prevSource = ""): string {
  const chars = [...word];
  const allCaps = isAllCaps(word);
  let out = "";
  let prev = prevSource;

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const lc = c.toLowerCase();
    const next = chars[i + 1]?.toLowerCase();
    let mapped: string | undefined;

    if (lc === "е") {
      mapped = prev === "" || CYRILLIC_VOWELS.has(prev) || prev === "ъ" || prev === "ь" ? "ye" : "e";
    } else if (lc === "ц") {
      mapped = prev !== "" && CYRILLIC_VOWELS.has(prev) ? "ts" : "s";
    } else if (lc === "с" && next === "ҳ") {
      mapped = `s${TUTUQ}`; // Исҳоқ → Is’hoq, not "Ishoq"
    } else {
      mapped = CYRILLIC_SINGLE[lc];
    }

    prev = isLetter(c) ? lc : "";
    if (mapped === undefined) {
      out += c;
      continue;
    }
    out += allCaps ? mapped.toUpperCase() : applyCase(c, mapped);
  }
  return out;
}

function cyrillicWordWithExceptions(word: string): string {
  const lower = word.toLowerCase();
  const allCaps = isAllCaps(word);
  const finish = (s: string) => (allCaps ? s.toUpperCase() : applyCase(word, s));

  const exact = CYR_EXACT.get(lower);
  if (exact) return finish(exact);

  for (const [lat, stem] of CYR_STEMS) {
    if (lower.startsWith(stem) && lower.length > stem.length) {
      const restStart = stem.length + (lower[stem.length] === "ь" ? 1 : 0);
      const rest = cyrillicWordToLatin(word.slice(restStart), stem.at(-1));
      return finish(lat) + (allCaps ? rest.toUpperCase() : rest);
    }
  }
  return cyrillicWordToLatin(word);
}

export function cyrillicToLatin(text: string): string {
  return mapWords(text, cyrillicWordWithExceptions);
}

// ---------------------------------------------------------------- helpers

export function detectScript(text: string): Script | null {
  let latin = 0;
  let cyrillic = 0;
  for (const c of text) {
    if (/[a-z]/i.test(c)) latin++;
    else if (/[Ѐ-ӿ]/.test(c)) cyrillic++;
  }
  if (latin === 0 && cyrillic === 0) return null;
  return cyrillic > latin ? "cyrillic" : "latin";
}

export function toScript(text: string, target: Script): string {
  return target === "cyrillic" ? latinToCyrillic(text) : cyrillicToLatin(text);
}

/** Unifies the many apostrophe variants in Uzbek Latin text: o‘, g‘ and ’. */
export function normalizeUzLatin(text: string): string {
  const okina = new RegExp(`([oOgG])[${APOSTROPHES}]`, "g");
  const tutuq = new RegExp(`(\\p{L})[${APOSTROPHES}](?=\\p{L})`, "gu");
  return mapWords(text, (word) =>
    word.replace(okina, `$1${OKINA}`).replace(tutuq, (m, letter: string) => (/[oOgG]/.test(letter) ? m : letter + TUTUQ)),
  );
}

/** Applies `fn` to every string of a JSON-like value (used for whole documents). */
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "id" || k === "type" ? v : mapStrings(v, fn)])) as T;
  }
  return value;
}
