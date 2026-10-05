# 🎓 EduGen AI — Texnik topshiriq (SPEC)

> Qisqa umumiy ko‘rinish: [README](../README.md). Bu hujjat — barcha tafsilotlar.

AI yordamida **esse, taqdimot va mustaqil ish** yaratadigan, ularni **PDF, DOCX, PPTX** formatida eksport qiladigan
va Canva-style web editorga ega fullstack platforma (Telegram bot + web).

> **Holat:** 🚧 loyihalash / MVP bosqichi. Quyidagi hujjat — arxitektura va texnik topshiriq (spec).
> Bajarilgan ishlar [26-bo‘lim (Roadmap)](#-26-roadmap)da belgilanadi.

---

## 📌 1. LOYIHA HAQIDA

EduGen AI — bu:

- 🤖 **Telegram bot** — tez yaratish: mavzu yuborasiz, tayyor fayl olasiz
- 🖥 **Web dashboard** — hujjatlar tarixi, qayta ochish, boshqarish
- 🎨 **Canva-style editor** — AI natijasini tahrirlash, shablon almashtirish, jonli preview
- 🧠 **AI content generator** — tuzilgan (strukturali) akademik matn
- 📄 **Export tizimi** — PDF, DOCX, PPTX

**Maqsadli auditoriya:** talabalar, maktab o‘quvchilari, o‘qituvchilar.

**Qo‘llab-quvvatlanadigan tillar:** o‘zbek (lotin), o‘zbek (kirill), rus, ingliz.

---

## 🎯 2. ASOSIY FUNKSIYALAR

### 🤖 AI generatsiya

| Tur | Natija | Sozlanadigan parametrlar |
|-----|--------|--------------------------|
| 📝 Esse | Sarlavha, kirish, asosiy qism (bo‘limlar), xulosa | til, hajm (so‘z), uslub |
| 📊 Taqdimot | Slaydlar: sarlavha + punktlar + spiker izohi | til, slaydlar soni, shablon |
| 📚 Mustaqil ish | Titul varaq, reja, kirish, boblar, xulosa, adabiyotlar | til, hajm (bet), titul ma’lumotlari |

### 📄 Export

| Format | Kutubxona | Qaysi turlar uchun |
|--------|-----------|--------------------|
| PDF (dizayn bilan) | `pdfkit` | hammasi |
| DOCX | `docx` | esse, mustaqil ish |
| PPTX (haqiqiy PowerPoint) | `pptxgenjs` | taqdimot |

### 🌐 Til va yozuv

- Foydalanuvchi **o‘ziga kerakli hujjat tili va yozuvini** bir marta tanlaydi (o‘zbek lotin / o‘zbek kirill /
  rus / ingliz) — keyin har safar so‘ralmaydi, kerak bo‘lsa bitta hujjat uchun o‘zgartiriladi
- **Interfeys tili** alohida: o‘zbek (lotin), o‘zbek (kirill), rus
- **Lotin ↔ kirill konvertatsiya** — tayyor hujjatni yoki istalgan matnni bir bosishda boshqa yozuvga o‘girish;
  AI’siz, bepul, limitga kirmaydi

### 🎨 Editor

- Shablon tizimi: **Modern / Minimal / Dark** — preview va eksport bir xil ko‘rinishda
- Matnni joyida tahrirlash, bo‘lim/slayd qo‘shish, o‘chirish, tartibini o‘zgartirish; jonli preview + avtosaqlash
- **AI matn tugmalari** — tanlangan matn uchun: ✂️ Qisqartir, ➕ Kengaytir, 💡 Soddalashtir, 📌 Misol qo‘sh
- **Versiyalar tarixi** — har qanday oldingi holatga qaytish
- **Taqdimot rejimi** — brauzerda to‘liq ekranda ko‘rsatish + **havola orqali ulashish**

### ⚙️ Ishonchlilik

- **Navbat (BullMQ + Redis)** — generatsiyalar alohida worker’da; server qayta ishga tushsa ham vazifa yo‘qolmaydi
- **Zaxira AI** — asosiy provayder ishlamasa, avtomatik ravishda ikkinchisiga o‘tiladi

### 💎 Tariflar va limitlar

- Har bir foydalanuvchiga kunlik generatsiya limiti (AI xarajatini nazorat qilish uchun) — [19-bo‘lim](#-19-tariflar-limitlar-va-tolovlar)

---

## 🧠 3. TEXNOLOGIYA STACK

| Qatlam | Texnologiya | Izoh |
|--------|-------------|------|
| Til | **TypeScript** (hamma joyda) | bot, backend, worker va web umumiy tiplardan foydalanadi |
| Monorepo | npm workspaces | `web`, `backend`, `bot`, `worker`, `shared` |
| Frontend | Next.js (App Router), Tailwind CSS, Zustand | |
| Backend | Node.js 22+ (LTS), Express | REST API + SSE |
| Telegram bot | Telegraf v4 + `@telegraf/session` (MongoDB store) | holat server qayta ishga tushganda yo‘qolmaydi |
| Navbat | BullMQ + Redis | qayta urinish, ustuvorlik, rate limit |
| AI | OpenAI API (asosiy) + zaxira provayder | `AIProvider` interfeysi; model nomlari env orqali |
| Validatsiya | zod | API kirishi va AI chiqishi tekshiriladi |
| Ma’lumotlar bazasi | MongoDB + Mongoose | |
| Fayl generatsiya | `pdfkit`, `docx`, `pptxgenjs` | fayllar xotirada (Buffer) yaratiladi |
| i18n | next-intl (web), umumiy JSON lug‘atlar (bot) | uz-latn, uz-cyrl, ru |
| Transliteratsiya | o‘z modulimiz — `shared/translit` | AI’siz, brauzerda ham ishlaydi |
| Ulashish ID | nanoid | taxmin qilib bo‘lmaydigan havolalar |
| Loglar | pino | |
| Testlar | Vitest, supertest, mongodb-memory-server | |

---

## 🧱 4. ARXITEKTURA

```text
Telegram foydalanuvchi            Web foydalanuvchi
           │                              │
           ▼                              ▼
  ┌─────────────────┐            ┌─────────────────┐
  │ bot/ (Telegraf) │            │  web/ (Next.js) │
  └────────┬────────┘            └────────┬────────┘
           │                              │ /api/* (rewrites)
           │                              ▼
           │                     ┌─────────────────┐
           │                     │ backend/ (REST) │
           │                     └────────┬────────┘
           │                              │
           └──────────┐       ┌───────────┘
                      ▼       ▼    vazifa qo‘shadi
                  ┌─────────────────┐
                  │ Redis (BullMQ)  │
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐       ┌──────────────────────┐
                  │ worker/         │──────▶│ AI: OpenAI           │
                  │ (generatsiya)   │       │ zaxira: 2-provayder  │
                  └────────┬────────┘       └──────────────────────┘
                           ▼
                     ┌──────────┐
                     │ MongoDB  │
                     └──────────┘
```

`shared/` — alohida servis emas: bot, backend va worker import qiladigan kutubxona (promptlar, AI router,
limitlar, modellar, shablonlar, generatorlar, translit). Bot va backend MongoDB’ni ham to‘g‘ridan-to‘g‘ri
o‘qiydi (tarix, sozlamalar). Worker tayyor natijani Telegram Bot API orqali foydalanuvchiga o‘zi yuboradi.

### Asosiy qarorlar

1. **Biznes-logika bitta joyda — `shared/`.** Bot, backend va worker bir xil promptlar, limitlar va
   generatorlardan foydalanadi. Aks holda bot va web natijalari bir-biridan farq qilib qoladi.
2. **Og‘ir ishlar navbat orqali.** Bot ham, backend ham faqat vazifa qo‘shadi va darhol javob beradi;
   AI chaqiruvlarini worker bajaradi. Worker’lar alohida masshtablanadi, qayta ishga tushganda vazifa yo‘qolmaydi.
3. **Bot backend’ga HTTP orqali murojaat qilmaydi** — `shared/`ni import qiladi va o‘sha MongoDB/Redis’ga ulanadi.
4. **Next.js API Routes faqat proksi.** `next.config` dagi `rewrites()` `/api/*` so‘rovlarini backend’ga
   yo‘naltiradi — shunda cookie bir domenda (CORS va third-party cookie muammosi yo‘q).
5. **AI faqat strukturali JSON qaytaradi** ([6-bo‘lim](#-6-kontent-sxemasi-yagona-format)). Dizayn AI’ga
   emas, shablonlarga bog‘liq — bitta kontentni istalgan shablon va formatda chiqarish mumkin.
6. **AI provayderga bog‘lanib qolinmaydi.** Kod `AIProvider` interfeysi bilan ishlaydi; OpenAI ishlamay
   qolsa, zaxira provayderga o‘tiladi ([7.6](#76-zaxira-ai-provayderi)).

### Generatsiya hayot sikli

```text
1. POST /api/generations     → limit band qilinadi → Generation (pending) → navbatga vazifa
                             ← 202 { id, status: "pending" }
2. worker (fonda)            → prompt → AI (asosiy, kerak bo‘lsa zaxira) → zod validatsiya
                             → MongoDB: progress 0…100, so‘ng status "done" | "failed"
3. GET /api/generations/:id  → har 2–3 s polling yoki SSE → Canvas render
```

Bot’da 1–2-qadamlar xuddi shunday; 3-qadam o‘rniga worker “⏳ Tayyorlanmoqda…” xabarini yangilab boradi va
tayyor natijani yuboradi.

---

## 📁 5. PROJECT STRUCTURE

```bash
edugen/
├── package.json             # npm workspaces: shared, backend, bot, worker, web
├── docker-compose.yml       # lokal MongoDB + Redis
├── .env.example             # backend, bot va worker uchun namunaviy env
├── shared/                  # umumiy yadro (@edugen/shared)
│   ├── src/
│   │   ├── schema/          # DocumentContent tiplari + zod sxemalar
│   │   ├── ai/
│   │   │   ├── providers/   # openai.ts + zaxira provayder (anthropic.ts yoki gemini.ts)
│   │   │   ├── router.ts    # asosiy → zaxira, circuit breaker
│   │   │   └── prompts/     # generatsiya va AI matn tugmalari promptlari
│   │   ├── queue/           # navbat nomlari, Redis ulanish, vazifa tiplari
│   │   ├── translit/        # lotin ↔ kirill (AI’siz, brauzerda ham ishlaydi)
│   │   ├── i18n/            # interfeys matnlari: uz-latn, ru (+ avtomatik uz-cyrl)
│   │   ├── templates/       # shablon tokenlari (rang, shrift, o‘lcham)
│   │   ├── export/          # pdf.ts, docx.ts, pptx.ts → Buffer qaytaradi
│   │   ├── versions/        # snapshot yaratish, tiklash, eskilarini tozalash
│   │   ├── db/              # Mongoose modellar + ulanish
│   │   └── limits/          # tariflar va kunlik limit logikasi
│   └── assets/
│       ├── fonts/           # PDF uchun TTF shriftlar (OFL litsenziya)
│       └── logo.png
├── backend/
│   └── src/
│       ├── index.ts         # Express server
│       ├── routes/          # auth, me, generations, versions, share, ai, public, health
│       └── middleware/      # auth, rate-limit, xatolarni qayta ishlash
├── worker/
│   └── src/
│       ├── index.ts         # BullMQ Worker’lar, graceful shutdown
│       └── processors/      # generate, regenerate-section, notify, cleanup
├── bot/
│   └── src/
│       ├── index.ts         # Telegraf (polling — lokal, webhook — prod)
│       ├── flows/           # yaratish, sozlamalar, /convert oqimlari
│       └── keyboards.ts
└── web/
    ├── .env.example         # web/.env.local uchun namuna
    ├── next.config.ts       # rewrites + transpilePackages: ["@edugen/shared"]
    └── src/
        ├── app/             # App Router sahifalari
        ├── components/
        │   ├── editor/      # Sidebar, Canvas, Toolbar, AiActions, VersionsPanel
        │   └── present/     # SlideViewer, PresenterView
        ├── i18n/            # next-intl sozlamasi
        └── store/           # Zustand
```

> ⚠️ `web` `shared`dan faqat brauzerga mos qismlarni import qiladi: `@edugen/shared/schema`,
> `@edugen/shared/templates`, `@edugen/shared/translit`, `@edugen/shared/i18n`. Root import (`@edugen/shared`)
> mongoose/pdfkit/bullmq’ni ham tortib keladi — buning uchun `shared/package.json`da `exports` subpath’lari aniqlanadi.

---

## 🧩 6. KONTENT SXEMASI (YAGONA FORMAT)

Barcha turlar uchun **bitta** format: AI shuni qaytaradi, editor shuni tahrirlaydi, generatorlar shundan
fayl yasaydi, translit va versiyalar ham shu bilan ishlaydi. Taqdimotda har bir `section` — bitta slayd.

```ts
// shared/src/schema/content.ts
export type DocType = "essay" | "presentation" | "work";
export type Language = "uz-latn" | "uz-cyrl" | "ru" | "en";
export type UiLanguage = "uz-latn" | "uz-cyrl" | "ru";
export type TemplateId = "modern" | "minimal" | "dark";

export interface Section {
  id: string;            // editor uchun barqaror kalit (server qo‘shadi, AI emas)
  heading: string;
  paragraphs?: string[]; // esse / mustaqil ish
  bullets?: string[];    // taqdimot slaydi
  notes?: string;        // spiker izohi (PPTX notes)
}

export interface DocumentContent {
  type: DocType;
  title: string;
  subtitle?: string;
  plan?: string[];        // mustaqil ish: "Reja"
  sections: Section[];
  references?: string[];  // "Foydalanilgan adabiyotlar" — foydalanuvchi tekshirishi shart!
}

// Titul varaq ma’lumotlari — AI emas, foydalanuvchi kiritadi
export interface TitleMeta {
  university?: string;
  faculty?: string;
  subject?: string;
  student?: string;
  group?: string;
  teacher?: string;
  city?: string;
  year?: number;
}
```

Har bir tip uchun mos zod sxema yoziladi; u AI’ga JSON Schema sifatida beriladi va javobni tekshirish
uchun ham ishlatiladi.

---

## 🧠 7. AI VA PROMPT ENGINEERING

### 7.1 Prompt tuzilmasi

```text
ROLE         — kim sifatida yozadi
TASK         — esse / taqdimot / mustaqil ish
TOPIC        — foydalanuvchi mavzusi (qo‘shtirnoq ichida, ≤ 200 belgi)
LANGUAGE     — uz-latn | ru | en  (uz-cyrl — 7.5 ga qarang)
LENGTH       — so‘z / slayd / bet soni
STRUCTURE    — majburiy bo‘limlar
STYLE        — akademik, aniq, suvsiz
CONSTRAINTS  — to‘qima fakt yo‘q, faqat JSON
```

### 7.2 Namuna (esse)

```text
[SYSTEM]
You are an experienced academic writer for Uzbek universities.
Write ONLY in Uzbek (Latin script). Use correct orthography: oʻ, gʻ, ʼ.
Return ONLY JSON that matches the provided schema.
Never invent statistics, quotes, laws, URLs or DOIs.
If a fact is uncertain, describe it in general terms instead.

[USER]
TASK: academic essay
TOPIC: "Sun'iy intellekt"
LENGTH: 800–1000 words, 4–5 sections
STRUCTURE: Kirish → Asosiy qism (2–3 bo‘lim) → Xulosa
STYLE: academic, clear, no filler, no repetition
```

### 7.3 Hajm standartlari

| Tur | Birlik | Standart | Chegara | Qoidalar |
|-----|--------|----------|---------|----------|
| Esse | so‘z | 800 | 400–2000 | 4–6 bo‘lim |
| Taqdimot | slayd | 10 | 5–20 | har slaydda 3–5 punkt, punkt ≤ 12 so‘z |
| Mustaqil ish | bet (A4) | 12 | 5–25 | 1 bet ≈ 250–300 so‘z (14 pt, 1.5 interval) |

Taqdimotda birinchi (muqova) va oxirgi (“E’tiboringiz uchun rahmat!”) slaydlarni **generator** qo‘shadi —
AI’ga token sarflanmaydi.

### 7.4 Uzun hujjatlar (mustaqil ish) — bosqichma-bosqich

Bitta so‘rovda 3000–7000 so‘zlik matn sifatsiz chiqadi va javob token limitiga uriladi (o‘zbek tilida
bir so‘z ingliz tilidagiga qaraganda ko‘proq token oladi). Shuning uchun worker:

1. **Reja** — sarlavha, reja va boblar ro‘yxati (1 so‘rov)
2. **Boblar** — har bir bob alohida so‘rov (bir vaqtda 2–3 tadan)
3. **Kirish va xulosa** — oxirida, tayyor reja asosida
4. **Adabiyotlar** — “tavsiya etilgan” sifatida; UI’da “tekshiring” ogohlantirishi bilan

Har bir qadamdan keyin `progress` va `stage` (“2/4-bob”) yangilanadi — foydalanuvchi jarayonni ko‘rib turadi.

### 7.5 Ishonchlilik qoidalari

- Javob zod orqali tekshiriladi; noto‘g‘ri bo‘lsa — xato matni bilan **1 marta** qayta so‘raladi
- **uz-cyrl hujjatlar:** AI `uz-latn`da yozadi → `shared/translit` kirillga o‘giradi. Modellar odatda
  lotin yozuvida kamroq imlo xatosi qiladi, natija esa ikkala yozuvda bir xil bo‘ladi
- Foydalanuvchi mavzusi faqat **ma’lumot** sifatida beriladi (qo‘shtirnoqda, yangi qatorlarsiz, uzunligi
  cheklangan) — prompt injection’ni kamaytirish uchun
- Har bir generatsiya uchun `provider`, `model`, `inputTokens`, `outputTokens`, `durationMs` saqlanadi
- Model nomlari kodga qattiq yozilmaydi — env orqali

### 7.6 Zaxira AI provayderi

Barcha AI chaqiruvlari bitta interfeys orqali o‘tadi — yangi provayder qo‘shish uchun bitta fayl yoziladi:

```ts
// shared/src/ai/providers/types.ts
export interface AIProvider {
  name: string; // "openai" | "anthropic" | "gemini"
  generateJson<T>(req: {
    schema: ZodType<T>;
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number } }>;
  streamText(req: { system: string; user: string; maxTokens: number }): AsyncIterable<string>;
}
```

`router.ts` avval asosiy provayderni (OpenAI), kerak bo‘lsa zaxirani chaqiradi:

| Holat | Harakat |
|-------|---------|
| 5xx, timeout, tarmoq xatosi | asosiyda 2 marta qayta urinish (exponential backoff) → zaxira |
| 429 (rate limit yoki kvota tugagan) | darhol zaxira |
| Yaroqsiz JSON (qayta so‘rashdan keyin ham) | zaxira |
| 400 (noto‘g‘ri so‘rov) | zaxiraga **o‘tilmaydi** — bu kod xatosi, log + `AI_ERROR` |
| Xavfsizlik bo‘yicha rad etish | zaxiraga **o‘tilmaydi** — foydalanuvchiga tushunarli xabar |

**Circuit breaker:** asosiy provayder 5 daqiqada ≥ 5 marta xato bersa, keyingi 2 daqiqa barcha so‘rovlar
to‘g‘ridan-to‘g‘ri zaxiraga yuboriladi; so‘ng bitta sinov so‘rovi asosiyga ketadi. Holat Redis’da — barcha
worker’lar uchun umumiy.

**Muhim:**

- Promptlar provayderga bog‘liq emas; JSON chiqishini ikkala tomonda ham bir xil zod sxema tekshiradi
- Zaxira modelning **o‘zbek tilidagi sifati** ishga tushirishdan oldin bir xil test mavzulari bilan sinab ko‘riladi
- Zaxira ishlatilgan generatsiyalar ulushi monitoring qilinadi ([25-bo‘lim](#-25-monitoring-va-loglar))
- Zaxira sozlanmagan bo‘lsa (`AI_FALLBACK_PROVIDER` bo‘sh) — faqat asosiy provayder ishlaydi

---

## 📬 8. NAVBAT VA WORKER (BULLMQ + REDIS)

### 8.1 Nima uchun

- AI javobi 20–90 s (mustaqil ish — bir necha daqiqa): HTTP so‘rov va Telegram handler’ni ushlab turmaslik kerak
- Server qayta ishga tushsa yoki yiqilsa — vazifa yo‘qolmaydi, boshqa worker davom ettiradi
- AI provayderining so‘rovlar limitiga (RPM) moslashish, Pro foydalanuvchilarga ustuvorlik
- Worker’larni bot va backend’dan alohida masshtablash

### 8.2 Navbatlar

| Navbat | Vazifa | Kim qo‘shadi | Urinishlar |
|--------|--------|--------------|------------|
| `generate` | to‘liq hujjat yaratish | bot, backend | 3 |
| `regenerate-section` | bitta bo‘limni qayta yaratish | backend | 2 |
| `notify` | Telegram’ga natija/xato xabarini yuborish | worker | 5 (Telegram `retry_after`ga amal qiladi) |
| `cleanup` (cron, har soatda) | eski versiyalar, muddati o‘tgan ulashish havolalari, osilib qolgan `pending`lar | worker | — |

### 8.3 Vazifa qo‘shish va worker

```ts
// vazifa qo‘shish (bot yoki backend)
await generateQueue.add("generate", { generationId }, {
  jobId: generationId,                     // takroriy qo‘shishdan himoya
  priority: user.plan === "pro" ? 1 : 10,  // kichik raqam — yuqori ustuvorlik
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
});

// worker/src/index.ts
new Worker("generate", processGenerate, {
  connection,                                   // ioredis: maxRetriesPerRequest: null (BullMQ talabi)
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  limiter: { max: 50, duration: 60_000 },       // AI provayder RPM chegarasiga moslang
});
```

### 8.4 Qoidalar

- **Idempotentlik:** processor boshida `Generation.status` tekshiriladi — `done` bo‘lsa qayta ishlanmaydi
- **Progress:** worker `progress` (0–100) va `stage`ni MongoDB’ga yozadi; web polling/SSE orqali ko‘radi,
  bot’dagi xabar ko‘pi bilan 3 s da bir marta tahrirlanadi (Telegram edit limitlari)
- **Oxirgi urinish ham xato bo‘lsa:** `status: "failed"`, limit qaytariladi, foydalanuvchiga
  “Xatolik yuz berdi, limit qaytarildi” xabari
- **Graceful shutdown:** `SIGTERM`da `worker.close()` — joriy vazifalar tugashini kutadi
- **Yiqilish:** worker o‘lsa, BullMQ vazifani *stalled* deb topadi va qayta ishlaydi
- **Telegram flood limitlari:** `notify` navbatida `limiter: { max: 25, duration: 1_000 }`
- **Redis talabi:** `maxmemory-policy noeviction` (aks holda BullMQ vazifalari o‘chib ketishi mumkin), AOF yoqilgan

---

## 🌐 9. TIL VA YOZUV

### 9.1 Foydalanuvchi sozlamalari

Foydalanuvchi o‘ziga kerakli tilni **bir marta** tanlaydi; bot va web bitta `User.settings`dan foydalanadi
(bir joyda o‘zgartirilsa, ikkinchisida ham o‘zgaradi).

| Sozlama | Qiymatlar | Standart |
|---------|-----------|----------|
| `uiLanguage` — interfeys tili | uz-latn, uz-cyrl, ru | Telegram `language_code` bo‘yicha (`ru` → ru, qolganlari → uz-latn) |
| `contentLanguage` — hujjatlar tili/yozuvi | uz-latn, uz-cyrl, ru, en | `uiLanguage` bilan bir xil |
| `defaultTemplate` — standart shablon | modern, minimal, dark | modern |

- Bot: birinchi `/start`da “Tilni tanlang” (O‘zbekcha / Ўзбекча / Русский), keyin `/settings`
- Web: `/settings` sahifasi
- Bitta hujjat uchun boshqa til: bot’da tasdiqlash bosqichidagi “🌐 Tilni o‘zgartirish” tugmasi,
  web’da `/new` formasidagi til maydoni (sozlama o‘zgarmaydi)

### 9.2 Interfeys tili (i18n)

- Matnlar `shared/src/i18n/locales/uz-latn.json` va `ru.json`da saqlanadi
- `uz-cyrl.json` qo‘lda yozilmaydi — `npm run i18n:cyrl` uni `uz-latn`dan translit orqali yaratadi
  (`{name}` kabi o‘rinbosarlar o‘zgarmaydi), so‘ng ko‘zdan kechiriladi
- Web: next-intl (kirmagan foydalanuvchi uchun til cookie’da); bot: umumiy `t(key, lang, params)`
- API xato kodlari (`LIMIT_EXCEEDED` va h.k.) interfeys tilidagi matnga shu lug‘at orqali aylantiriladi

### 9.3 Lotin ↔ kirill konvertatsiya

`shared/translit` — sof TypeScript, AI ishlatmaydi: bot, backend, worker va **brauzer**da bir xil ishlaydi.

**Asosiy qoidalar:**

| Lotin | Kirill | Izoh |
|-------|--------|------|
| sh, ch | ш, ч | |
| o‘, g‘ | ў, ғ | `o'`, `` o` ``, `oʻ`, `o’` — hammasi bir xil qabul qilinadi |
| h / x | ҳ / х | |
| q | қ | |
| yo, yu, ya | ё, ю, я | lekin `yo‘` → `йў` (yo‘l → йўл) |
| ye / e | е / э | `e` so‘z boshida va unlidan keyin → `э` (eshik → эшик) |
| s’h | сҳ | Is’hoq → Исҳоқ (tutuq belgisi harflarni ajratadi) |
| ʼ (tutuq belgisi) | ъ | ma’no → маъно |

Kirill → lotin yo‘nalishidagi qo‘shimcha qoidalar: `ц` → `s` (so‘z boshida va undoshdan keyin) yoki `ts`
(unlidan keyin); `е` → `ye` (so‘z boshida va unlidan keyin) yoki `e`; `ь` tushib qoladi; `ъ` → `ʼ`.

- **Istisnolar lug‘ati** — rus tilidan o‘zlashgan so‘zlar uchun (sentabr ↔ сентябрь, sirk ↔ цирк,
  konsert ↔ концерт); lotin → kirill yo‘nalishida `ц`, `ь`, `я`ni tiklash uchun kerak
- **O‘girilmaydi:** URL, email, `{o‘rinbosar}`, kod, lug‘atdagi xorijiy qisqartma va nomlar (PDF, AI, Python).
  O‘zbekcha qisqartmalar o‘giriladi: AQSH → АҚШ, BMT → БМТ
- Katta harflar saqlanadi: `Sh` → `Ш`, `SHAHAR` → `ШАҲАР`
- Yo‘nalish avtomatik aniqlanadi: harflarning ko‘pi kirill bo‘lsa → lotinga, aks holda → kirillga

**Qayerda ishlaydi:**

| Joy | Qanday |
|-----|--------|
| Tayyor hujjat (web) | Toolbar’dagi “Lotin / Кирилл” → `POST /api/generations/:id/convert`: joyida (oldin versiya saqlanadi) yoki nusxa sifatida |
| Tayyor hujjat (bot) | Natija ostidagi “🔤 Кириллча / Lotincha” tugmasi → nusxa yaratiladi, fayllar yangi yozuvda yuboriladi |
| Istalgan matn (bot) | `/convert` → matn yuboriladi → o‘girilgan matn qaytadi (4096 belgidan uzun bo‘lsa — `.txt` fayl) |
| Istalgan matn (web) | Ommaviy `/convert` sahifasi — butunlay brauzerda ishlaydi, serverga yuk yo‘q |

Konvertatsiya bepul va kunlik limitga kirmaydi (faqat suiiste’moldan himoya uchun rate limit).

---

## 🤖 10. TELEGRAM BOT

### 10.1 Buyruqlar (BotFather → `/setcommands`)

```text
start - Boshlash
new - Yangi hujjat yaratish
history - Oxirgi hujjatlarim
convert - Lotin ↔ kirill o‘girish
settings - Til, yozuv va shablon sozlamalari
plan - Tarif va qolgan limit
web - Web editorni ochish
help - Yordam
cancel - Bekor qilish
```

### 10.2 Oqim

1. `/start` → foydalanuvchi ro‘yxatga olinadi → **birinchi marta:** “Tilni tanlang” → asosiy menyu
2. `choose_type` — 📝 Esse / 📊 Taqdimot / 📚 Mustaqil ish
3. `waiting_topic` — mavzu (3–200 belgi)
4. `choose_length` — tayyor variantlar (masalan: 8 / 10 / 15 slayd)
5. `waiting_meta` — faqat mustaqil ish uchun: titul ma’lumotlari (o‘tkazib yuborish mumkin)
6. `choose_template` — Modern / Minimal / Dark (namuna rasm bilan; standart — sozlamadagi)
7. `confirm` — xulosa (tur, mavzu, **til**, hajm, shablon) + “✅ Yaratish” / “🌐 Tilni o‘zgartirish”
   - “🌐 Tilni o‘zgartirish” → `choose_language` → yana `confirm` (faqat shu hujjat uchun)
8. `generating` — vazifa navbatga qo‘shiladi; worker xabarni yangilab boradi: “⏳ Navbatda…” → “✍️ 2/4-bob…”
9. `done` — worker qisqa preview va tugmalarni yuboradi:

```text
[📄 PDF] [📝 DOCX] [📊 PPTX]
[🔤 Кириллча] [🔗 Ulashish]
[✏️ Web’da tahrirlash] [🔁 Qayta yaratish]
```

`/cancel` istalgan holatdan `idle`ga qaytaradi. `/convert` → `waiting_convert_text` → matn → natija.

### 10.3 Holat (session)

```ts
interface BotSession {
  step: "idle" | "choose_type" | "waiting_topic" | "choose_length" | "waiting_meta"
      | "choose_template" | "confirm" | "choose_language" | "generating" | "waiting_convert_text";
  type?: DocType;
  topic?: string;
  language?: Language;   // bo‘sh bo‘lsa — User.settings.contentLanguage
  length?: number;
  template?: TemplateId;
  meta?: TitleMeta;
  generationId?: string;
}
```

Session MongoDB’da saqlanadi (`@telegraf/session`) — xotirada (in-memory) emas, aks holda har deploy’da
barcha foydalanuvchilarning holati yo‘qoladi.

### 10.4 Muhim texnik jihatlar

- **Handler faqat vazifa qo‘shadi.** Natijani worker `Generation.botContext` (`chatId`, `progressMessageId`)
  bo‘yicha o‘zi yuboradi — bot qayta ishga tushsa ham natija yetib boradi. Webhook rejimida handler
  kechiksa Telegram update’ni qayta yuboradi; tez javob takroriy generatsiyaning oldini oladi.
- **Ikki marta bosishdan himoya** — foydalanuvchida `pending` generatsiya bo‘lsa, yangisi boshlanmaydi.
- **Fayllar xotiradan yuboriladi:** `replyWithDocument({ source: buffer, filename })` (diskka yozilmaydi).
- **Fayllar talab bo‘yicha yaratiladi** — tugma bosilganda, hammasi birdaniga emas (CPU tejaladi).
- **Interfeys matnlari** foydalanuvchining `uiLanguage`ida (`t()` orqali), qattiq yozilgan matn yo‘q.
- **Telegram cheklovlari:** xabar ≤ 4096 belgi (preview qisqartiriladi), `callback_data` ≤ 64 bayt
  (`exp:pdf:<id>`, `cv:<id>`, `sh:<id>` kabi qisqa kodlar), bot yuboradigan fayl ≤ 50 MB.
- **Polling faqat bitta instansda.** Ikkita instans bir vaqtda polling qilsa — `409 Conflict`.
  Prod’da webhook + `secretToken`.

---

## 🖥 11. WEB (NEXT.JS)

### 11.1 Sahifalar

| Route | Vazifa | Auth |
|-------|--------|------|
| `/` | Landing | — |
| `/login` | Kirish (bot orqali yoki Telegram Login Widget) | — |
| `/auth/callback` | Bot’dagi bir martalik havolani sessiyaga almashtiradi | — |
| `/dashboard` | Hujjatlar ro‘yxati, qidiruv, “➕ Yangi yaratish” | ✅ |
| `/new` | Tur, mavzu, til, hajm, shablon tanlash formasi (standartlar — sozlamalardan) | ✅ |
| `/editor/[id]` | Canva-style editor | ✅ |
| `/editor/[id]/present` | Taqdimot rejimi (egasi uchun) | ✅ |
| `/p/[shareId]` | Ulashilgan hujjat / taqdimot (faqat o‘qish) | — |
| `/convert` | Lotin ↔ kirill matn konvertori | — |
| `/settings` | Interfeys tili, hujjatlar tili/yozuvi, standart shablon | ✅ |
| `/pricing` | Tariflar | — |

Himoyalangan sahifalar `middleware.ts` orqali cookie bo‘lmasa `/login`ga yo‘naltiriladi.

### 11.2 Kirish (auth)

Web foydalanuvchi va bot foydalanuvchisi **bitta akkaunt** bo‘lishi uchun kirish Telegram orqali:

1. **Bot orqali havola (asosiy, lokalda ham ishlaydi):** bot’da `/web` yoki “✏️ Web’da tahrirlash” →
   bir martalik token (10 daqiqa, bir marta ishlatiladi, bazada hash holida) → `WEB_URL/auth/callback?token=…`
   → backend tokenni tekshiradi va httpOnly cookie (JWT) o‘rnatadi.
2. **Telegram Login Widget (ixtiyoriy):** domen BotFather’da `/setdomain` orqali ulanadi; backend
   `hash`ni HMAC-SHA256 (kalit — `SHA256(BOT_TOKEN)`) bilan tekshiradi va `auth_date` eskirmaganini ko‘radi.

### 11.3 Editor layout

```text
┌──────────────┬──────────────────────────────┬────────────────┐
│ Sidebar      │ Canvas                       │ Toolbar        │
│ · shablon    │ · A4 sahifa (esse, mustaqil) │ · PDF/DOCX/PPTX│
│ · bo‘limlar  │ · 16:9 slayd (taqdimot)      │ · Ko‘rsatish   │
│ · qayta gen. │ · joyida tahrirlash          │ · Ulashish     │
│              │ · matn tanlansa: AI tugmalar │ · Versiyalar   │
│              │                              │ · Lotin/Кирилл │
└──────────────┴──────────────────────────────┴────────────────┘
```

**MVP doirasi:** matnni joyida tahrirlash, bo‘lim/slayd qo‘shish/o‘chirish/ko‘chirish, shablon almashtirish,
bitta bo‘limni AI bilan qayta yaratish, AI matn tugmalari, versiyalar, taqdimot rejimi, ulashish, eksport.
**Keyinroq:** erkin drag-and-drop joylashuv, rasmlar, o‘z ranglari va shriftlari (to‘liq “Canva” darajasi).

### 11.4 State (Zustand)

```ts
interface EditorState {
  doc: DocumentContent | null;
  template: TemplateId;
  revision: number;                 // konflikt himoyasi (13.4)
  status: "idle" | "generating" | "saving" | "error";
  dirty: boolean;
  selectedSectionId: string | null;

  setTemplate(t: TemplateId): void;
  updateSection(id: string, patch: Partial<Section>): void;
  addSection(afterId?: string): void;
  removeSection(id: string): void;
  moveSection(from: number, to: number): void;
}
```

- **Avtosaqlash:** o‘zgarishdan 1.5 s keyin (debounce) `PATCH /api/generations/:id` (`revision` bilan)
- **Undo/redo:** `zundo` middleware — sessiya ichidagi tezkor qaytarish; doimiy tarix — versiyalar (13-bo‘lim)
- **Sahifadan chiqishda** saqlanmagan o‘zgarish bo‘lsa — ogohlantirish

### 11.5 Live preview

Canvas shablon tokenlarini (`@edugen/shared/templates`) eksport bilan **bir xil** manbadan oladi.
HTML preview va pdfkit’dagi qator bo‘linishlari 100% mos kelmasligi mumkin — piksel aniqligi kerak bo‘lsa,
keyinroq PDF’ni Playwright (HTML → PDF) orqali yaratishga o‘tish mumkin.

---

## ✨ 12. AI MATN TUGMALARI

Editor’da paragraf yoki punkt ichida matn belgilanganda kichik panel chiqadi:

| Tugma | `action` | Nima qiladi | Hajm |
|-------|----------|-------------|------|
| ✂️ Qisqartir | `shorten` | ma’noni saqlab qisqartiradi | ~50% |
| ➕ Kengaytir | `expand` | tushuntirish va tafsilot qo‘shadi | ~150–200% |
| 💡 Soddalashtir | `simplify` | murakkab so‘z va jumlalarni soddalashtiradi (maktab o‘quvchisi darajasi) | ≈ |
| 📌 Misol qo‘sh | `example` | mavzuga mos 1–2 ta hayotiy misol qo‘shadi | + |

**UX:** natija stream bo‘lib oynachada chiqadi (eski ↔ yangi) → “✅ Qabul qilish” / “🔁 Qayta” /
“↩️ Bekor qilish”. Qabul qilingach tanlangan matn almashtiriladi, `Ctrl+Z` ishlaydi.

**So‘rov:**

```json
POST /api/ai/rewrite
{
  "generationId": "6702f1c8e4b0a1b2c3d4e5f6",
  "sectionId": "s3",
  "action": "simplify",
  "text": "tanlangan matn (≤ 2000 belgi)"
}
```

Javob — SSE stream: `data: {"delta":"..."}` … `data: {"done":true}`.

**Qoidalar:**

- Javob kiritilgan matn bilan **bir xil til va yozuvda**; kirill matn lotinga o‘girilib AI’ga beriladi,
  javob qayta kirillga o‘giriladi (7.5 bilan bir xil yondashuv)
- Kontekst sifatida hujjat sarlavhasi va bo‘lim sarlavhasi beriladi (mazmun izchil bo‘lishi uchun)
- Faqat oddiy matn qaytadi (markdown yo‘q); yangi statistika, sana va iqtiboslar o‘ylab topilmaydi
- Taqdimot punktida natija ≤ 12 so‘z bo‘lishi talab qilinadi
- Model: `OPENAI_MODEL_FAST` (tezroq va arzonroq), zaxira AI router’i shu yerda ham ishlaydi
- Navbatga qo‘yilmaydi (qisqa, interaktiv so‘rov, timeout 30 s), lekin alohida kunlik limitga ega (19-bo‘lim)

---

## 🕘 13. VERSIYALAR TARIXI

### 13.1 Qachon versiya yaratiladi

| Hodisa | `reason` |
|--------|----------|
| AI hujjatni birinchi marta yaratdi | `generated` |
| Bo‘limni qayta yaratishdan oldin | `before_regenerate` |
| Lotin ↔ kirill o‘girishdan oldin (joyida) | `before_convert` |
| Boshqa versiyani tiklashdan oldin (joriy holat) | `before_restore` |
| Tahrirlash davomida — ko‘pi bilan 10 daqiqada bir marta | `autosave` |
| Foydalanuvchi “💾 Versiyani saqlash” bosdi (nom bilan) | `manual` |

Har bir versiya — to‘liq snapshot (`content`, `template`, `meta`). Hujjatlar kichik (10–100 KB), shuning
uchun diff saqlash shart emas.

### 13.2 Saqlash limiti

- Avtomatik versiyalar: Free — oxirgi 10 ta, Pro — oxirgi 100 ta; eskilari `cleanup` vazifasida o‘chiriladi
- `manual` versiyalar avtomatik o‘chirilmaydi (Free — 5 ta, Pro — 50 ta)

### 13.3 Tiklash

Tiklash **hech narsani yo‘qotmaydi**: avval joriy holat `before_restore` versiyasi sifatida saqlanadi,
so‘ng tanlangan versiya hujjatga ko‘chiriladi. Ya’ni tiklashni ham bekor qilish mumkin.

**UI:** “Versiyalar” paneli → ro‘yxat (sana, sabab, nom) → bosilganda Canvas’da faqat o‘qish rejimida
ko‘rinadi → “Tiklash”.

### 13.4 Konflikt himoyasi

`Generation.revision` har saqlashda +1 bo‘ladi. `PATCH` so‘rovi joriy `revision`ni yuboradi; mos kelmasa —
`409 CONFLICT` (masalan, hujjat boshqa oynada yoki worker tomonidan o‘zgartirilgan). UI: “Hujjat boshqa joyda
o‘zgartirildi — yangilang” va saqlanmagan o‘zgarishlar alohida versiya sifatida saqlanadi.

---

## ▶️ 14. TAQDIMOT REJIMI VA ULASHISH

### 14.1 Taqdimot rejimi

- “▶ Ko‘rsatish” → `/editor/[id]/present` → brauzerning **Fullscreen API**si
- Slaydlar Canvas bilan bir xil komponentlarda chiziladi, 16:9 nisbatda ekranga moslashadi
- Klavishlar: `→` / `Space` / `PageDown` — keyingi, `←` / `PageUp` — oldingi, `Home` / `End`,
  `F` — to‘liq ekran, `S` — spiker oynasi, `Esc` — chiqish; telefonda — swipe
- **Spiker oynasi (presenter view):** joriy va keyingi slayd, `notes`, taymer; asosiy oyna bilan
  `BroadcastChannel` orqali sinxron
- Esse va mustaqil ish uchun — “o‘qish rejimi” (A4 sahifalar ketma-ket)

### 14.2 Havola orqali ulashish

- “🔗 Ulashish” → `shareId = nanoid(21)` → `WEB_URL/p/{shareId}`
- Sozlamalar:

| Sozlama | Standart |
|---------|----------|
| Ulashish yoqilgan | o‘chiq (egasi yoqadi) |
| PDF yuklab olishga ruxsat | o‘chiq |
| Titul ma’lumotlarini ko‘rsatish (F.I.Sh, guruh…) | o‘chiq |
| Amal qilish muddati | cheksiz (7 / 30 kun tanlash mumkin) |

- O‘chirib, qayta yoqilsa — **yangi** `shareId` beriladi, eski havola ishlamay qoladi
- Ommaviy sahifa: auth yo‘q, faqat o‘qish, hujjatning **joriy** holati ko‘rsatiladi
- `noindex` (qidiruv tizimlari indekslamaydi), ko‘rishlar soni (`views`) hisoblanadi
- Open Graph: sarlavha + muqova slayd rasmi (`next/og`) — Telegram’da havola chiroyli preview bilan chiqadi
- Bot: natija ostidagi “🔗 Ulashish” tugmasi ulashishni yoqadi va havolani yuboradi

---

## 🎨 15. SHABLON TIZIMI

| Shablon | Fon | Asosiy rang | Sarlavha / matn shrifti | Qachon mos |
|---------|-----|-------------|-------------------------|------------|
| Modern | `#FFFFFF` | `#4F46E5` | Montserrat / Inter | taqdimot, esse |
| Minimal | `#FFFFFF` | `#111827` | Inter / Inter | rasmiy hujjatlar |
| Dark | `#0F172A` | `#38BDF8` | Montserrat / Inter | ekranda ko‘rsatiladigan taqdimot |

```ts
// shared/src/templates/index.ts — yagona manba (web preview, taqdimot rejimi, PDF, DOCX, PPTX)
export const templates = {
  modern: {
    colors: { bg: "#FFFFFF", text: "#111827", primary: "#4F46E5", accent: "#F59E0B", muted: "#6B7280" },
    fonts:  { heading: "Montserrat", body: "Inter" },
  },
  // minimal, dark ...
} satisfies Record<TemplateId, Template>;
```

**Qoidalar:**

- Shrift **lotin, kirill va `ʻ` (U+02BB)** belgilarini qo‘llashi shart (o‘zbek tili uchun)
- DOCX — chop etish uchun: Dark shablonda ham oq fon, faqat aksent rangi olinadi
- PPTX/DOCX shriftni faylga joylamaydi — kompyuterda shrift bo‘lmasa almashtiriladi
  (zaxira: Arial / Calibri / Times New Roman)

---

## 📄 16. FAYL GENERATORLARI

Umumiy qoidalar (uchala format uchun):

- Kirish: `DocumentContent` + `TemplateId` + `TitleMeta` → chiqish: `Buffer`
- Diskka yozilmaydi (Railway/Render fayl tizimi vaqtinchalik) — xotirada yaratib, to‘g‘ridan-to‘g‘ri yuboriladi
- Fayl nomi: `slugify(title)` + tur, masalan `sun-iy-intellekt_esse.pdf`
- HTTP javobida lotin bo‘lmagan nomlar uchun
  `Content-Disposition: attachment; filename="esse.pdf"; filename*=UTF-8''<encoded>`

### 16.1 PDF — `pdfkit`

- **Shriftlarni embed qilish majburiy:** standart PDF shriftlari (Helvetica va h.k.) kirill va `ʻ`
  belgilarini ko‘rsatmaydi → `doc.registerFont()` bilan TTF (masalan, Noto Sans / Noto Serif)
- Muqova sahifa: logo, sarlavha, muallif, yil
- Sarlavhalar, justify paragraflar, shablon ranglari
- Pastki kolontitul: sahifa raqami (`bufferPages: true`, oxirida sahifalar bo‘ylab yuriladi)
- Taqdimot PDF’i — 16:9 sahifalar (`[960, 540]` pt), har sahifada bitta slayd

### 16.2 DOCX — `docx`

Akademik formatlash (ko‘p OTMlarda talab qilinadi; sozlanadigan):

| Parametr | Qiymat |
|----------|--------|
| Shrift | Times New Roman, 14 pt |
| Qator oralig‘i | 1.5 |
| Hoshiyalar | chap 3 sm, o‘ng 1.5 sm, yuqori/past 2 sm |
| Xatboshi | 1.25 sm |
| Sahifa raqami | pastda, markazda (titulda yo‘q) |

- Titul varaq (`TitleMeta`dan), Reja, Heading 1/2 stillari (Word navigatsiyasi ishlashi uchun)
- Mundarija (`TableOfContents`) — Word ochilganda maydonlarni yangilashni so‘raydi
- Adabiyotlar — raqamlangan ro‘yxat
- `Packer.toBuffer(doc)`

### 16.3 PPTX — `pptxgenjs`

- `pptx.layout = "LAYOUT_WIDE"` (16:9)
- Har shablon uchun `defineSlideMaster`: `TITLE`, `CONTENT`, `SECTION`, `END`
- Tuzilma: muqova → kontent slaydlar → xulosa → “E’tiboringiz uchun rahmat!”
- `notes` → spiker izohlari
- Matn sig‘masligi: asosiy himoya — prompt’dagi limitlar (3–5 punkt, ≤ 12 so‘z); qo‘shimcha —
  matn uzunligiga qarab shrift o‘lchamini kichraytirish
- `pptx.write({ outputType: "nodebuffer" })`

---

## 🔌 17. BACKEND API

Barcha javoblar JSON (eksport va SSE’dan tashqari). Auth — httpOnly cookie.

| Method | Path | Vazifa | Auth |
|--------|------|--------|------|
| `GET` | `/health` | Servis, DB va Redis holati | — |
| `POST` | `/api/auth/telegram` | Login Widget ma’lumotini tekshirish → cookie | — |
| `POST` | `/api/auth/token` | Bot’dagi bir martalik tokenni almashtirish → cookie | — |
| `POST` | `/api/auth/logout` | Chiqish | ✅ |
| `GET` | `/api/me` | Foydalanuvchi, sozlamalar, tarif, bugungi qolgan limitlar | ✅ |
| `PATCH` | `/api/me/settings` | `uiLanguage`, `contentLanguage`, `defaultTemplate` | ✅ |
| `POST` | `/api/generations` | Yangi generatsiya (navbatga qo‘shiladi) | ✅ |
| `GET` | `/api/generations?cursor=` | Tarix (pagination) | ✅ |
| `GET` | `/api/generations/:id` | Bitta hujjat (status, progress, content) | ✅ |
| `GET` | `/api/generations/:id/events` | Progress SSE (polling o‘rniga) | ✅ |
| `PATCH` | `/api/generations/:id` | Editor’dan saqlash (`content`, `template`, `meta`, `revision`) | ✅ |
| `POST` | `/api/generations/:id/sections/:sectionId/regenerate` | Bitta bo‘limni qayta yaratish (navbat) | ✅ |
| `POST` | `/api/generations/:id/convert` | Lotin ↔ kirill: `{ to, mode: "in_place" \| "copy" }` | ✅ |
| `DELETE` | `/api/generations/:id` | O‘chirish | ✅ |
| `GET` | `/api/generations/:id/export/:format` | `pdf` \| `docx` \| `pptx` fayl | ✅ |
| `POST` | `/api/ai/rewrite` | AI matn tugmalari (SSE stream) | ✅ |
| `GET` | `/api/generations/:id/versions` | Versiyalar ro‘yxati | ✅ |
| `GET` | `/api/generations/:id/versions/:versionId` | Bitta versiya | ✅ |
| `POST` | `/api/generations/:id/versions` | Qo‘lda saqlash `{ label }` | ✅ |
| `POST` | `/api/generations/:id/versions/:versionId/restore` | Versiyani tiklash | ✅ |
| `PUT` | `/api/generations/:id/share` | Ulashish: `{ enabled, allowDownload, showMeta, expiresInDays }` | ✅ |
| `GET` | `/api/public/:shareId` | Ulashilgan hujjat (faqat `content` + `template`) | — |
| `GET` | `/api/public/:shareId/export/pdf` | PDF (agar egasi ruxsat bergan bo‘lsa) | — |
| `GET` | `/admin/queues` | Bull Board — navbatlar holati | admin |

> Har bir `:id` so‘rovida hujjat **joriy foydalanuvchiga tegishli**ligi tekshiriladi (aks holda `404`).

### `POST /api/generations`

```json
{
  "type": "presentation",
  "topic": "Sun'iy intellekt ta'limda",
  "language": "uz-latn",
  "template": "modern",
  "options": { "slides": 10 }
}
```

`language` va `template` yuborilmasa — `User.settings`dan olinadi. Javob — `202 Accepted`:

```json
{ "id": "6702f1c8e4b0a1b2c3d4e5f6", "status": "pending" }
```

### Xatolar formati

```json
{ "error": { "code": "LIMIT_EXCEEDED", "message": "Bugungi limit tugadi. Ertaga qayta urinib ko‘ring." } }
```

`message` foydalanuvchining `uiLanguage`ida qaytadi.

| HTTP | `code` | Qachon |
|------|--------|--------|
| 400 | `VALIDATION_ERROR` | noto‘g‘ri kirish (zod) |
| 401 | `UNAUTHORIZED` | cookie yo‘q / eskirgan |
| 404 | `NOT_FOUND` | hujjat yo‘q, boshqa foydalanuvchiniki yoki ulashish o‘chirilgan/muddati o‘tgan |
| 409 | `ALREADY_GENERATING` | foydalanuvchida tugallanmagan generatsiya bor |
| 409 | `CONFLICT` | `revision` mos kelmadi (hujjat boshqa joyda o‘zgartirilgan) |
| 429 | `LIMIT_EXCEEDED` / `RATE_LIMITED` | kunlik limit / juda ko‘p so‘rov |
| 502 | `AI_ERROR` | asosiy va zaxira AI ikkalasi ham ishlamadi yoki yaroqsiz javob |

---

## 🗄 18. MA’LUMOTLAR BAZASI

### User

```js
{
  telegramId: Number,          // unique index
  username: String,
  firstName: String,
  languageCode: String,        // Telegram’dan — standart sozlamalar uchun
  settings: {
    uiLanguage: "uz-latn" | "uz-cyrl" | "ru",
    contentLanguage: "uz-latn" | "uz-cyrl" | "ru" | "en",
    defaultTemplate: "modern" | "minimal" | "dark"
  },
  plan: "free" | "pro",
  planExpiresAt: Date,
  isBlocked: Boolean,          // botni bloklagan yoki admin bloklagan
  createdAt: Date,
  updatedAt: Date
}
```

### Generation

```js
{
  userId: ObjectId,            // ref: User
  parentId: ObjectId,          // nusxa bo‘lsa (masalan, kirillga o‘girilgan)
  source: "bot" | "web",
  type: "essay" | "presentation" | "work",
  topic: String,
  language: "uz-latn" | "uz-cyrl" | "ru" | "en",
  template: "modern" | "minimal" | "dark",
  options: { words, slides, pages },
  meta: TitleMeta,
  content: DocumentContent,    // 6-bo‘limdagi sxema
  revision: Number,            // har saqlashda +1 (13.4)
  status: "pending" | "done" | "failed",
  progress: Number,            // 0–100
  stage: String,               // "reja", "2/4-bob", "xulosa"
  error: String,
  botContext: { chatId, progressMessageId },   // worker natijani qayerga yuborishi
  share: {
    id: String,                // nanoid(21)
    enabled: Boolean,
    allowDownload: Boolean,
    showMeta: Boolean,
    expiresAt: Date,
    views: Number
  },
  ai: { provider, model, inputTokens, outputTokens, durationMs, usedFallback },
  createdAt: Date,
  updatedAt: Date
}
```

### Version

```js
{
  generationId: ObjectId,
  userId: ObjectId,
  reason: "generated" | "before_regenerate" | "before_convert" | "before_restore" | "autosave" | "manual",
  label: String,               // faqat manual uchun
  content: DocumentContent,
  template: String,
  meta: TitleMeta,
  createdAt: Date
}
```

### Usage (kunlik limitlar)

```js
{ userId: ObjectId, date: "2026-10-03", kind: "generation" | "ai_action", count: Number }
// unique: { userId, date, kind }
```

- Sana **Asia/Tashkent** vaqt zonasi bo‘yicha
- Limit atomik tekshiriladi:
  `findOneAndUpdate({ userId, date, kind, count: { $lt: limit } }, { $inc: { count: 1 } }, { upsert: true })`
  — limit tugagan bo‘lsa upsert `E11000` beradi → `LIMIT_EXCEEDED`
- Generatsiya `failed` bo‘lsa, hisob qaytariladi (`$inc: { count: -1 }`)

### LoginToken (bot → web kirish)

```js
{ userId: ObjectId, tokenHash: String, expiresAt: Date, usedAt: Date }   // TTL index: expiresAt
```

### Payment (3-bosqich)

```js
{
  userId: ObjectId,
  provider: "stars" | "click" | "payme" | "stripe",
  amount: Number,
  currency: "XTR" | "UZS" | "USD",
  status: "pending" | "paid" | "failed" | "refunded",
  externalId: String,          // unique — webhook takrorlanganda ikki marta hisoblanmaydi
  createdAt: Date
}
```

### Indekslar

| Kolleksiya | Indeks |
|------------|--------|
| users | `{ telegramId: 1 }` unique |
| generations | `{ userId: 1, createdAt: -1 }` |
| generations | `{ "share.id": 1 }` unique (partial — faqat `share.id` mavjud bo‘lsa) |
| generations | `{ status: 1, createdAt: 1 }` — osilib qolgan `pending`larni topish uchun |
| versions | `{ generationId: 1, createdAt: -1 }` |
| usages | `{ userId: 1, date: 1, kind: 1 }` unique |
| logintokens | `{ expiresAt: 1 }` TTL |
| payments | `{ externalId: 1 }` unique |

Osilib qolgan vazifalar: worker o‘lsa, BullMQ vazifani qayta ishlaydi (8.4). Qo‘shimcha himoya sifatida
`cleanup` vazifasi 30 daqiqadan eski `pending` generatsiyalarni `failed` qiladi va limitni qaytaradi.

---

## 💳 19. TARIFLAR, LIMITLAR VA TO‘LOVLAR

| | Free | Pro |
|---|------|-----|
| Kunlik generatsiya | 3 | 50 |
| AI matn tugmalari (kuniga) | 20 | 300 |
| Shablonlar | Modern, Minimal | hammasi |
| Mustaqil ish hajmi | ≤ 10 bet | ≤ 25 bet |
| Avtomatik versiyalar | oxirgi 10 ta | oxirgi 100 ta |
| Navbatda ustuvorlik | oddiy | yuqori |
| Taqdimot rejimi va ulashish | ✅ | ✅ |
| Lotin ↔ kirill konvertatsiya | ✅ cheksiz | ✅ cheksiz |
| PDF/PPTX’da watermark | bor | yo‘q |

> Raqamlar — misol; `shared/src/limits`da sozlanadi.

**To‘lovlar (3-bosqich):**

- **Bot ichida — Telegram Stars (XTR).** Telegram qoidalariga ko‘ra bot ichida raqamli xizmatlar uchun to‘lov Stars orqali qabul qilinadi.
- **Web’da — Click / Payme** (UZS). Stripe — xalqaro to‘lovlar uchun (O‘zbekistonda ro‘yxatdan o‘tgan kompaniya uchun mavjud emas, xorijiy yuridik shaxs kerak).
- Tarif **faqat provayder webhook’i tasdiqlagandan keyin** yoqiladi (redirect sahifasiga ishonilmaydi); webhook’lar idempotent (`externalId`).

---

## 🔐 20. XAVFSIZLIK

- Barcha `/api/generations*` endpointlarda (versiyalar, konvertatsiya, ulashish sozlamalari ham) auth +
  **egalik tekshiruvi** — boshqa birovning hujjatini ID orqali ochib bo‘lmaydi
- Rate limit: IP bo‘yicha (`express-rate-limit`, Redis store) + foydalanuvchi bo‘yicha kunlik limitlar
  (generatsiya va AI matn tugmalari alohida — AI xarajatini himoya qiladi)
- Barcha kirishlar zod bilan tekshiriladi; mavzu ≤ 200 belgi, AI tugmalari uchun matn ≤ 2000 belgi
- **Ulashish havolalari:** `nanoid(21)` (taxmin qilib bo‘lmaydi), `noindex`, titul ma’lumotlari standart
  bo‘yicha yashirin, o‘chirilgan/muddati o‘tgan havola → `404`, `/api/public/*` uchun alohida rate limit;
  ommaviy javobda `userId` va boshqa ichki maydonlar qaytarilmaydi
- Cookie: `httpOnly`, `Secure`, `SameSite=Lax`; web va API bir domenda (Next.js rewrites)
- `helmet`; CORS faqat `WEB_URL`
- Telegram webhook: `secretToken` (`X-Telegram-Bot-Api-Secret-Token` sarlavhasi tekshiriladi)
- **Redis** ommaviy internetga ochilmaydi (ichki tarmoq + parol); Bull Board faqat admin uchun
- Admin buyruqlari (`/stats`, `/ban`) faqat `ADMIN_IDS` uchun
- `.env` git’ga qo‘shilmaydi (`.gitignore`), repoda faqat `.env.example`; token oshkor bo‘lsa — darhol
  almashtiriladi (BotFather `/revoke`, AI provayder kalitlari ham)
- Loglarga tokenlar, cookie va to‘liq hujjat matni yozilmaydi
- Ixtiyoriy: mavzuni moderatsiya API orqali tekshirish

---

## ⚙️ 21. ENVIRONMENT O‘ZGARUVCHILARI

### `.env` (root — backend, bot va worker uchun)

```env
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/edugen
REDIS_URL=redis://localhost:6379
# Bot havolalari, ulashish havolalari va CORS uchun
WEB_URL=http://localhost:3000

# --- AI (asosiy) ---
OPENAI_API_KEY=
# Model nomlarini shu yerda tanlang (kodga qattiq yozilmaydi)
OPENAI_MODEL=
# AI matn tugmalari uchun tezroq/arzonroq model; bo'sh bo'lsa OPENAI_MODEL ishlatiladi
OPENAI_MODEL_FAST=
OPENAI_TIMEOUT_MS=120000

# --- AI (zaxira, ixtiyoriy) ---
# anthropic | gemini; bo'sh bo'lsa zaxira o'chirilgan
AI_FALLBACK_PROVIDER=
AI_FALLBACK_API_KEY=
AI_FALLBACK_MODEL=

# --- Backend ---
PORT=4000
# Kamida 32 belgili tasodifiy satr: openssl rand -hex 32
JWT_SECRET=

# --- Worker ---
WORKER_CONCURRENCY=5

# --- Bot ---
BOT_TOKEN=
# Bo'sh bo'lsa polling (lokal); prod'da: https://bot.example.com
BOT_WEBHOOK_DOMAIN=
BOT_WEBHOOK_SECRET=
# Vergul bilan: 12345678,87654321
ADMIN_IDS=
```

### `web/.env.local` (Next.js faqat o‘z papkasidagi env’ni o‘qiydi)

```env
# Next.js rewrites uchun (server tomonda)
API_URL=http://localhost:4000
# Open Graph va ulashish havolalari uchun to'liq manzil
WEB_URL=http://localhost:3000
NEXT_PUBLIC_BOT_USERNAME=edugen_ai_bot
```

---

## ▶️ 22. LOKAL ISHGA TUSHIRISH

### Talablar

- Node.js 22+ (LTS)
- Docker (lokal MongoDB va Redis uchun) yoki MongoDB Atlas + boshqariladigan Redis
- Telegram bot tokeni: [@BotFather](https://t.me/BotFather) → `/newbot`
- OpenAI API kaliti (zaxira provayder kaliti — ixtiyoriy)

### Qadamlar

```bash
git clone <repo-url> edugen
cd edugen
cp .env.example .env
cp web/.env.example web/.env.local
docker compose up -d mongo redis
npm install
npm run dev
```

`.env` va `web/.env.local`dagi qiymatlarni `npm run dev`dan oldin to‘ldiring.

`docker-compose.yml`:

```yaml
services:
  mongo:
    image: mongo:8
    ports: ["27017:27017"]
    volumes: [mongo-data:/data/db]
  redis:
    image: redis:7
    command: ["redis-server", "--maxmemory-policy", "noeviction", "--appendonly", "yes"]
    ports: ["6379:6379"]
    volumes: [redis-data:/data]
volumes:
  mongo-data:
  redis-data:
```

### Skriptlar

| Buyruq | Vazifa |
|--------|--------|
| `npm run dev` | backend, worker, bot va web’ni parallel ishga tushiradi (`concurrently`) |
| `npm run dev -w backend` | faqat backend (`tsx watch`) — http://localhost:4000 |
| `npm run dev -w worker` | faqat worker |
| `npm run dev -w bot` | faqat bot (polling) |
| `npm run dev -w web` | faqat web — http://localhost:3000 |
| `npm run i18n:cyrl` | `uz-latn.json`dan `uz-cyrl.json`ni yaratish |
| `npm run build` | barcha workspace’larni build qilish |
| `npm test` | barcha testlar |
| `npm run lint` | ESLint |

---

## 🧪 23. TESTLAR

| Qism | Nima tekshiriladi | Vosita |
|------|-------------------|--------|
| `shared/schema` | zod sxemalar, yaroqsiz AI javoblari rad etilishi | Vitest |
| `shared/ai` | prompt builder (snapshot), qayta urinish — **AI mock** | Vitest |
| `shared/ai/router` | 5xx/429 → zaxira; 400 → zaxiraga o‘tmaydi; circuit breaker ochilishi va yopilishi | Vitest |
| `shared/translit` | ikki tomonlama namunalar (O‘zbekiston ↔ Ўзбекистон, yo‘l ↔ йўл, Is’hoq ↔ Исҳоқ, ma’no ↔ маъно, eshik ↔ эшик, sirk ↔ цирк, sentabr ↔ сентябрь), URL/kod/o‘rinbosarlar o‘zgarmasligi, katta harflar | Vitest |
| `shared/export` | PDF `%PDF` bilan boshlanadi, DOCX/PPTX — yaroqli ZIP (`PK`); kirill va `ʻ` bilan matn | Vitest |
| `shared/limits` | kunlik limitlar, parallel so‘rovlarda poyga holati | Vitest + mongodb-memory-server |
| `shared/versions` | tiklashdan oldin snapshot, limitdan oshganda eskilarini o‘chirish | Vitest + mongodb-memory-server |
| `worker` | idempotentlik, oxirgi urinishda `failed` + limit qaytarilishi | Vitest + Redis (docker) |
| `backend` | endpointlar, auth, egalik, `revision` konflikti (409), ulashish (o‘chirilgan/muddati o‘tgan → 404, meta yashirin) | supertest + mongodb-memory-server |
| `bot` | oqim holatlari o‘tishlari, `/cancel`, `/settings`, `/convert` | Vitest |

Testlarda haqiqiy AI provayderlar hech qachon chaqirilmaydi.

**CI:** lint → test → build (har push va merge request’da).

---

## 🚀 24. DEPLOY

| Qism | Platforma | Eslatma |
|------|-----------|---------|
| `web` | Vercel | Root Directory: `web`; env: `API_URL`, `WEB_URL`, `NEXT_PUBLIC_BOT_USERNAME` |
| `backend` | Railway / Render | start: `node backend/dist/index.js`; health check: `/health` |
| `worker` | Railway / Render (alohida servis) | start: `node worker/dist/index.js`; bir nechta instans bo‘lishi mumkin; `BOT_TOKEN` kerak (natija yuborish uchun) |
| `bot` | Railway / Render (alohida servis) | prod’da **webhook** (`BOT_WEBHOOK_DOMAIN`, `BOT_WEBHOOK_SECRET`) |
| Redis | Railway Redis / Render Key Value | `maxmemory-policy noeviction`, faqat ichki tarmoqdan ulanish |
| DB | MongoDB Atlas | alohida DB foydalanuvchi, Network Access’da faqat kerakli IP’lar, backup yoqilgan |

**Eslatmalar:**

- Bepul tariflarda servis “uxlab qoladi” — birinchi so‘rov sekin; bot va worker uchun doimiy ishlaydigan tarif tavsiya etiladi
- Polling rejimida bot faqat **bitta** instansda ishlashi kerak; worker’lar esa bemalol ko‘paytiriladi
- BotFather: `/setcommands`, `/setdescription`, `/setuserpic`; Login Widget uchun `/setdomain`
- Deploy’dan keyin: `/health` → bot’da `/start` → yaratish → web’da kirish → har bir formatda eksport →
  ulashish havolasini boshqa brauzerda ochish

---

## 📈 25. MONITORING VA LOGLAR

- **Loglar:** pino (JSON), har so‘rov va vazifada `requestId` / `jobId`
- **Xatolar:** Sentry (ixtiyoriy)
- **Navbat:** Bull Board (`/admin/queues`) — kutayotgan, bajarilayotgan va xato bergan vazifalar
- **Metrikalar** (bazadan yoki admin `/stats` buyrug‘i orqali):
  - kunlik generatsiyalar soni (tur va til bo‘yicha)
  - navbatda o‘rtacha kutish vaqti va o‘rtacha generatsiya davomiyligi
  - `failed` ulushi
  - **zaxira AI ishlatilgan generatsiyalar ulushi** — oshib ketsa, asosiy provayderda muammo bor
  - kunlik token sarfi (provayder bo‘yicha) → taxminiy AI xarajati
  - AI matn tugmalari ishlatilishi (qaysi `action` ko‘proq)
  - ulashilgan havolalar va ko‘rishlar soni
  - faol foydalanuvchilar, Free → Pro konversiya

---

## 🗺 26. ROADMAP

### Bosqich 1 — MVP (bot)
- [ ] Monorepo, `shared` yadro, MongoDB modellar
- [ ] `AIProvider` interfeysi va OpenAI provayderi
- [ ] AI generatsiya: esse, taqdimot, mustaqil ish (JSON + zod)
- [ ] Navbat: BullMQ + Redis, `worker/` (`generate`, `notify`)
- [ ] PDF / DOCX / PPTX generatorlar (Modern shablon)
- [ ] Telegram bot oqimi, session, kunlik limit
- [ ] Til va yozuv sozlamalari (`/settings`), interfeys: uz-latn, uz-cyrl, ru
- [ ] Lotin ↔ kirill: `shared/translit`, bot’da `/convert` va hujjat tugmasi
- [ ] Deploy (bot + worker + Redis + DB)

### Bosqich 2 — Web
- [ ] Bot orqali kirish (bir martalik havola)
- [ ] Dashboard (tarix), `/settings`, ommaviy `/convert` sahifasi
- [ ] Editor MVP: tahrirlash, bo‘limlar, shablon almashtirish, avtosaqlash
- [ ] AI matn tugmalari: qisqartir, kengaytir, soddalashtir, misol qo‘sh
- [ ] Versiyalar tarixi + `revision` konflikt himoyasi
- [ ] Taqdimot rejimi (to‘liq ekran, spiker oynasi)
- [ ] Havola orqali ulashish (`/p/[shareId]`, Open Graph preview)
- [ ] Zaxira AI provayder + circuit breaker
- [ ] Minimal va Dark shablonlar
- [ ] Bitta bo‘limni qayta yaratish

### Bosqich 3 — Monetizatsiya
- [ ] Pro tarif, Telegram Stars (bot)
- [ ] Click / Payme (web)
- [ ] Pro uchun navbatda ustuvorlik va kengaytirilgan limitlar
- [ ] Admin panel (foydalanuvchilar, to‘lovlar, statistika)

### Bosqich 4 — Kelajak
- [ ] 🔥 PDF dizayn tizimi (HTML → PDF, piksel aniqlikdagi preview)
- [ ] 🔥 PPTX murakkab layout’lar, slaydlarga rasmlar
- [ ] 🔥 AI auto-design (mavzuga qarab shablon/rang tanlash)
- [ ] 🔥 To‘liq Canva-style erkin editor
- [ ] 🔥 Template marketplace
- [ ] Yuklangan DOCX fayllarni formatini saqlagan holda lotin ↔ kirill o‘girish
- [ ] Versiyalarni solishtirish (diff)
- [ ] OTM / maktablar uchun SaaS (jamoaviy akkauntlar)

---

## ⚠️ 27. CHEKLOVLAR VA MAS’ULIYAT

- AI matni xato yoki noaniq ma’lumot o‘z ichiga olishi mumkin — foydalanuvchi natijani tekshirishi kerak
- **Adabiyotlar ro‘yxati** AI tomonidan “tavsiya” sifatida beriladi va mavjud bo‘lmagan manbalar bo‘lishi
  mumkin — UI’da va bot’da bu haqda ogohlantiriladi
- Zaxira AI ishlatilganda matn uslubi asosiy provayderdagidan biroz farq qilishi mumkin
- Lotin ↔ kirill konvertatsiya qoidalarga asoslangan: rus tilidan o‘zlashgan, lug‘atda yo‘q so‘zlarda
  xato bo‘lishi mumkin — muhim hujjatlarni ko‘zdan kechirish tavsiya etiladi
- Platforma o‘quv jarayoniga yordamchi vosita; foydalanuvchi o‘z ta’lim muassasasining akademik halollik
  qoidalariga amal qilishi kerak
- Mustaqil ish formatlash talablari OTMga qarab farq qiladi — standart sozlamalar o‘zgartiriladigan qilib qo‘yilgan

---

**EduGen AI — AI + Design + Automation 🚀**
