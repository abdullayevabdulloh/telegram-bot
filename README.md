# 🎓 EduGen AI Platform

AI yordamida **esse, taqdimot, mustaqil ish** yaratadigan, ularni **PDF, DOCX, PPTX** formatida eksport qiladigan
va Canva-style web editorga ega fullstack platforma — **Telegram bot + web**.

> 🚧 **Holat:** 1-bosqich (Telegram bot + worker) yozilgan va testlangan; web (2-bosqich) hali yo‘q.
> 📘 Barcha texnik tafsilotlar: [docs/SPEC.md](docs/SPEC.md)

---

## 📌 1. LOYIHA HAQIDA

EduGen AI — bu:

- 🤖 **Telegram bot** — mavzu yuborasiz, tayyor fayl olasiz
- 🖥 **Web dashboard** — hujjatlar tarixi va boshqaruv
- 🎨 **Canva-style editor** — tahrirlash, shablonlar, jonli preview
- 🧠 **AI generator** — tuzilgan akademik matn
- 📄 **Export** — PDF, DOCX, PPTX

**Kimlar uchun:** talabalar, maktab o‘quvchilari, o‘qituvchilar
**Tillar:** o‘zbek (lotin), o‘zbek (kirill), rus, ingliz

---

## 🎯 2. ASOSIY FUNKSIYALAR

### 🤖 AI generatsiya

| Tur | Natija |
|-----|--------|
| 📝 Esse | Sarlavha, kirish, asosiy qism, xulosa |
| 📊 Taqdimot | Slaydlar: sarlavha + punktlar + spiker izohi |
| 📚 Mustaqil ish | Titul varaq, reja, kirish, boblar, xulosa, adabiyotlar |

### 📄 Export

| Format | Kutubxona | Turlar |
|--------|-----------|--------|
| PDF (dizayn bilan) | `pdfkit` | hammasi |
| DOCX | `docx` | esse, mustaqil ish |
| PPTX | `pptxgenjs` | taqdimot |

### 🌐 Til va yozuv
- Foydalanuvchi o‘ziga kerakli **hujjat tili va yozuvini** bir marta tanlaydi — keyin har safar so‘ralmaydi
- **Interfeys tili** alohida: o‘zbek (lotin / kirill), rus
- **Lotin ↔ kirill** — hujjat yoki istalgan matnni bir bosishda o‘girish (AI’siz, bepul)

### 🎨 Editor
- Shablonlar: **Modern / Minimal / Dark / Aurora / Pastel** — preview va eksport bir xil
- Joyida tahrirlash, bo‘lim/slayd qo‘shish, o‘chirish, ko‘chirish, avtosaqlash
- **AI tugmalari** tanlangan matn uchun: ✂️ Qisqartir · ➕ Kengaytir · 💡 Soddalashtir · 📌 Misol qo‘sh
- **Versiyalar tarixi** — istalgan oldingi holatga qaytish
- **Taqdimot rejimi** — to‘liq ekran + **havola orqali ulashish**

### ⚙️ Ishonchlilik
- **Navbat (BullMQ + Redis)** — generatsiyalar alohida worker’da, vazifalar yo‘qolmaydi
- **Zaxira AI** — asosiy provayder ishlamasa, avtomatik ikkinchisiga o‘tiladi
- **Kunlik limitlar** — AI xarajati nazoratda

---

## 🧠 3. TEXNOLOGIYA STACK

| Qatlam | Texnologiya |
|--------|-------------|
| Til | TypeScript (hamma joyda), npm workspaces monorepo |
| Frontend | Next.js (App Router), Tailwind CSS, Zustand, next-intl |
| Backend | Node.js 22+, Express (REST + SSE) |
| Telegram bot | Telegraf v4 + `@telegraf/session` (MongoDB) |
| Navbat | BullMQ + Redis |
| AI | OpenAI API (asosiy) + zaxira provayder, zod bilan validatsiya |
| Ma’lumotlar bazasi | MongoDB + Mongoose |
| Fayllar | `pdfkit`, `docx`, `pptxgenjs` |
| Testlar | Vitest, supertest, mongodb-memory-server |

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

**Asosiy tamoyillar:**

1. **Umumiy yadro — `shared/`:** promptlar, AI router, limitlar, shablonlar, generatorlar, translit.
   Bot, backend va worker bir xil koddan foydalanadi.
2. **Og‘ir ishlar navbatda:** bot va backend faqat vazifa qo‘shadi va darhol javob beradi, AI’ni worker chaqiradi.
3. **AI faqat JSON qaytaradi**, dizayn — shablonlarda. Bitta kontent istalgan formatda chiqadi.
4. **AI provayderga bog‘lanmagan:** umumiy `AIProvider` interfeysi + zaxira provayder.
5. **Web va API bir domenda** (Next.js rewrites) — cookie va CORS muammosi yo‘q.

---

## 📁 5. LOYIHA TUZILMASI

```bash
edugen/
├── shared/      # umumiy yadro: schema, ai, queue, translit, i18n, templates, export, versions, db, limits
├── backend/     # REST API (Express) — 2-bosqich
├── worker/      # BullMQ worker’lar: generate, regenerate-section, notify, cleanup
├── bot/         # Telegram bot (Telegraf)
├── web/         # Next.js: dashboard, editor, taqdimot rejimi — 2-bosqich
├── docs/        # SPEC.md — to‘liq texnik topshiriq
├── docker-compose.yml   # lokal MongoDB + Redis
└── .env.example
```

---

## 🧩 6. KONTENT FORMATI

Barcha turlar uchun **bitta** format — AI shuni qaytaradi, editor tahrirlaydi, generatorlar fayl yasaydi:

```ts
interface DocumentContent {
  type: "essay" | "presentation" | "work";
  title: string;
  subtitle?: string;
  plan?: string[];          // mustaqil ish: reja
  sections: {
    id: string;
    heading: string;
    paragraphs?: string[];  // esse / mustaqil ish
    bullets?: string[];     // taqdimot slaydi
    notes?: string;         // spiker izohi
  }[];
  references?: string[];    // adabiyotlar — tekshirish shart!
}
```

Titul varaq ma’lumotlari (OTM, fakultet, talaba, guruh, o‘qituvchi) AI’dan emas, foydalanuvchidan olinadi.

---

## 🧠 7. AI VA PROMPTLAR

**Prompt tuzilmasi:** `ROLE → TASK → TOPIC → LANGUAGE → LENGTH → STRUCTURE → STYLE → CONSTRAINTS`

```text
Write an academic essay in Uzbek (Latin script) about: "Sun'iy intellekt"
LENGTH: 800–1000 words, 4–5 sections
STRUCTURE: Kirish → Asosiy qism → Xulosa
RULES: no invented statistics, quotes, URLs or DOIs; return ONLY JSON matching the schema
```

| Tur | Standart hajm | Chegara |
|-----|---------------|---------|
| Esse | 800 so‘z | 400–2000 |
| Taqdimot | 10 slayd (3–5 punkt, ≤ 12 so‘z) | 5–20 |
| Mustaqil ish | 12 bet | 5–25 |

- **Mustaqil ish bosqichma-bosqich** yoziladi: reja → har bir bob alohida → kirish va xulosa
- **Kirill hujjatlar:** AI lotinda yozadi → translit kirillga o‘giradi (imlo sifati bir xil)
- **Ishonchlilik:** zod validatsiya, xatoda qayta so‘rash, token sarfi har generatsiyada saqlanadi
- **Zaxira AI:** 5xx, timeout, 429 yoki yaroqsiz JSON’da zaxira provayderga o‘tiladi; asosiy provayder
  tez-tez xato bersa, bir muddat so‘rovlar to‘g‘ridan-to‘g‘ri zaxiraga ketadi (circuit breaker)

---

## 📬 8. NAVBAT (BULLMQ + REDIS)

| Navbat | Vazifa |
|--------|--------|
| `generate` | to‘liq hujjat yaratish (3 urinish) |
| `regenerate-section` | bitta bo‘limni qayta yaratish |
| `notify` | natijani Telegram’ga yuborish (flood limitlariga mos) |
| `cleanup` | eski versiyalar, muddati o‘tgan havolalar, osilib qolgan vazifalar |

- Worker jarayonni (`progress`, “2/4-bob”) MongoDB’ga yozadi — web va bot uni ko‘rsatadi
- Oxirgi urinish ham xato bo‘lsa — `failed`, limit foydalanuvchiga qaytariladi
- Redis: `maxmemory-policy noeviction`, ommaviy internetga ochilmaydi

---

## 🌐 9. TIL VA YOZUV

**Sozlamalar** (bot’da `/settings`, web’da `/settings` — ikkalasi sinxron):

| Sozlama | Qiymatlar |
|---------|-----------|
| Interfeys tili | uz-latn, uz-cyrl, ru |
| Hujjatlar tili/yozuvi | uz-latn, uz-cyrl, ru, en |
| Standart shablon | modern, minimal, dark, aurora, pastel |

Bitta hujjat uchun tilni yaratishdan oldin alohida o‘zgartirish mumkin.

**Lotin ↔ kirill** (`shared/translit`, AI’siz, brauzerda ham ishlaydi):

| Lotin | Kirill | Misol |
|-------|--------|-------|
| sh, ch, q, h / x | ш, ч, қ, ҳ / х | shahar → шаҳар |
| o‘, g‘ (`o'`, `oʻ`, `o’` ham) | ў, ғ | O‘zbekiston → Ўзбекистон |
| yo, yu, ya, `yo‘` | ё, ю, я, `йў` | yo‘l → йўл |
| e (so‘z boshida) / ye | э / е | eshik → эшик |
| ʼ (tutuq) | ъ | ma’no → маъно |

Rus tilidan o‘zlashgan so‘zlar uchun istisnolar lug‘ati bor (sentabr ↔ сентябрь, sirk ↔ цирк).
URL, kod va xorijiy nomlar (PDF, Python) o‘girilmaydi.

---

## 🤖 10. TELEGRAM BOT

**Buyruqlar:** `/start` · `/new` · `/history` · `/convert` · `/settings` · `/plan` · `/web` · `/help` · `/cancel`

**Oqim:**

```text
/start → til tanlash (faqat birinchi marta) → menyu
  → tur → mavzu → hajm → (titul ma’lumotlari) → shablon → tasdiqlash (🌐 tilni o‘zgartirish)
  → ⏳ navbatda… → ✍️ yozilmoqda… → natija
```

**Natija tugmalari:**

```text
[📄 PDF] [📝 DOCX] [📊 PPTX]
[🔤 Кириллча] [🔗 Ulashish]
[✏️ Web’da tahrirlash] [🔁 Qayta yaratish]
```

**Muhim:** session MongoDB’da; handler faqat vazifa qo‘shadi, natijani worker yuboradi; fayllar xotiradan
yuboriladi; prod’da webhook + `secretToken`.

---

## 🖥 11. WEB (NEXT.JS)

| Sahifa | Vazifa |
|--------|--------|
| `/` | Landing |
| `/login` | Telegram orqali kirish (bot’dagi bir martalik havola yoki Login Widget) |
| `/dashboard` | Hujjatlar tarixi, “➕ Yangi yaratish” |
| `/editor/[id]` | Canva-style editor |
| `/editor/[id]/present` | Taqdimot rejimi |
| `/p/[shareId]` | Ulashilgan hujjat (ommaviy, faqat o‘qish) |
| `/convert` | Lotin ↔ kirill konvertor (ommaviy) |
| `/settings` | Til, yozuv, standart shablon |

### Editor

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

- **AI tugmalari:** natija yozilib turgan holda ko‘rinadi → “✅ Qabul qilish” / “↩️ Bekor qilish”;
  matn tili va yozuvi saqlanadi; alohida kunlik limit
- **Versiyalar:** AI yaratganda, katta o‘zgarishlardan oldin, tahrirlashda (10 daqiqada 1 marta) va qo‘lda
  saqlanadi; tiklash hech narsani yo‘qotmaydi; ikki oynada bir vaqtda tahrirlash ustma-ust yozilmaydi
- **Taqdimot rejimi:** to‘liq ekran, `←` / `→` / `Space`, `S` — spiker oynasi (izohlar + taymer), telefonda swipe
- **Ulashish:** `/p/[shareId]` havolasi; egasi o‘chirib qo‘ysa yoki muddati o‘tsa — ishlamaydi;
  titul ma’lumotlari standart bo‘yicha yashirin; Telegram’da chiroyli preview

---

## 🎨 12. SHABLONLAR

| Shablon | Fon | Asosiy rang | Shrift | Qachon |
|---------|-----|-------------|--------|--------|
| Modern | `#FFFFFF` | `#4F46E5` | Montserrat / Inter | taqdimot, esse |
| Minimal | `#FFFFFF` | `#111827` | Inter | rasmiy hujjatlar |
| Dark | `#0F172A` | `#38BDF8` | Montserrat / Inter | ekranda ko‘rsatish |
| Aurora | to‘q gradient (mavzu rangida) | mavzu rangi | Montserrat / Inter | zamonaviy taqdimot: nurli fon, shisha kartochkalar |
| Pastel | yorug‘ pastel gradient | mavzu rangi | Poppins / Inter | yengil, zamonaviy taqdimot |

Ranglar va shriftlar bitta joyda (`shared/templates`) — preview, taqdimot rejimi va barcha eksportlar
shundan foydalanadi. Shriftlar lotin, kirill va `ʻ` belgisini qo‘llashi shart.

---

## 📄 13. FAYL GENERATORLARI

| Format | Asosiy jihatlar |
|--------|-----------------|
| **PDF** | Muqova, logo, ranglar, sahifa raqami; **TTF shrift embed qilinadi** (standart shriftlar kirill va `ʻ`ni ko‘rsatmaydi) |
| **DOCX** | Akademik format: Times New Roman 14 pt, 1.5 interval, hoshiyalar 3 / 1.5 / 2 / 2 sm; titul, reja, mundarija, adabiyotlar |
| **PPTX** | 16:9, har shablon uchun slide master; muqova → slaydlar → xulosa → “Rahmat!”; spiker izohlari |

Fayllar xotirada yaratiladi (diskka yozilmaydi) va talab bo‘yicha — tugma bosilganda.

---

## 🔌 14. BACKEND API

| Guruh | Endpointlar |
|-------|-------------|
| Auth | `POST /api/auth/token` · `POST /api/auth/telegram` · `POST /api/auth/logout` |
| Profil | `GET /api/me` · `PATCH /api/me/settings` |
| Generatsiya | `POST /api/generations` · `GET /api/generations` · `GET` / `PATCH` / `DELETE /api/generations/:id` · `GET /api/generations/:id/events` (SSE) |
| Tahrirlash | `POST /api/ai/rewrite` (SSE) · `POST …/:id/sections/:sectionId/regenerate` · `POST …/:id/convert` |
| Versiyalar | `GET` / `POST …/:id/versions` · `POST …/:id/versions/:versionId/restore` |
| Ulashish | `PUT …/:id/share` · `GET /api/public/:shareId` |
| Eksport | `GET …/:id/export/:format` — `pdf` / `docx` / `pptx` |
| Tizim | `GET /health` · `GET /admin/queues` (Bull Board, faqat admin) |

```text
POST /api/generations
{ "type": "presentation", "topic": "Sun'iy intellekt ta'limda", "language": "uz-latn", "template": "modern", "options": { "slides": 10 } }

→ 202 { "id": "6702f1c8e4b0a1b2c3d4e5f6", "status": "pending" }
```

**Xato kodlari:** `VALIDATION_ERROR` 400 · `UNAUTHORIZED` 401 · `NOT_FOUND` 404 · `ALREADY_GENERATING` / `CONFLICT` 409 ·
`LIMIT_EXCEEDED` / `RATE_LIMITED` 429 · `AI_ERROR` 502

---

## 🗄 15. MA’LUMOTLAR BAZASI

| Kolleksiya | Asosiy maydonlar |
|------------|------------------|
| `users` | telegramId, settings (uiLanguage, contentLanguage, defaultTemplate) |
| `generations` | userId, type, topic, language, template, content, status, progress, revision, share, ai (provider, tokens) |
| `versions` | generationId, reason, content, template, createdAt |
| `usages` | userId, date (Toshkent vaqti), kind (`generation` / `ai_action`), count |
| `logintokens` | tokenHash, expiresAt (TTL) |

---

## 🎁 16. TARIF

Pullik tarif yo‘q — barcha imkoniyatlar hamma uchun bepul. Kunlik limitlar faqat AI xarajatini nazorat qiladi:

| | Hamma uchun |
|---|------|
| Generatsiya (kuniga) | 50 |
| AI tugmalari (kuniga) | 300 |
| Shablonlar | hammasi |
| Mustaqil ish | ≤ 25 bet |
| Versiyalar | oxirgi 100 ta |
| Taqdimot rejimi, ulashish, lotin ↔ kirill | ✅ |
| Watermark | yo‘q |

> Raqamlar `shared/limits`da sozlanadi.

---

## 🔐 17. XAVFSIZLIK

- Har bir hujjat so‘rovida auth + **egalik tekshiruvi**
- Rate limit (IP bo‘yicha) + kunlik limitlar (generatsiya va AI tugmalari alohida)
- Barcha kirishlar zod bilan tekshiriladi (mavzu ≤ 200, AI tugmalari uchun matn ≤ 2000 belgi)
- Ulashish havolalari taxmin qilib bo‘lmaydi (`nanoid(21)`), `noindex`, ichki maydonlar ko‘rsatilmaydi
- httpOnly cookie, `helmet`, CORS faqat `WEB_URL`, Telegram webhook `secretToken`
- Redis va Bull Board ommaviy emas; `.env` git’ga qo‘shilmaydi

---

## ⚙️ 18. ENVIRONMENT

`.env` (bot va worker; namunasi — `.env.example`):

```env
NODE_ENV=development
LOG_LEVEL=info
MONGODB_URI=mongodb://localhost:27017/edugen
REDIS_URL=redis://localhost:6379
WEB_URL=http://localhost:3000

# AI — majburiy: kalit va model nomi
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_MODEL_FAST=
OPENAI_TIMEOUT_MS=120000

# Zaxira AI (ixtiyoriy) — Claude; kalit bo'sh bo'lsa zaxira o'chirilgan
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-5-5

# Taqdimot fotolari (ixtiyoriy) — https://www.pexels.com/api/
PEXELS_API_KEY=

# Worker
WORKER_CONCURRENCY=5

# Bot — majburiy: BOT_TOKEN. BOT_WEBHOOK_DOMAIN bo'sh bo'lsa — polling
BOT_TOKEN=
BOT_WEBHOOK_DOMAIN=
BOT_WEBHOOK_SECRET=
BOT_WEBHOOK_PORT=8080
ADMIN_IDS=
```

2-bosqichda qo‘shiladi: `PORT`, `JWT_SECRET` (backend) va `web/.env.local` (`API_URL`, `WEB_URL`, `NEXT_PUBLIC_BOT_USERNAME`).

---

## ▶️ 19. ISHGA TUSHIRISH

**Talablar:** Node.js 22+, Docker, Telegram bot tokeni ([@BotFather](https://t.me/BotFather)), OpenAI API kaliti.

```bash
git clone <repo-url> edugen
cd edugen
cp .env.example .env
npm install
npm run db:up
npm run dev
```

`npm run dev`dan oldin `.env`da `BOT_TOKEN`, `OPENAI_API_KEY` va `OPENAI_MODEL`ni to‘ldiring.

| Buyruq | Vazifa |
|--------|--------|
| `npm run db:up` / `npm run db:down` | MongoDB + Redis’ni Docker’da ishga tushirish / to‘xtatish |
| `npm run dev` | worker + bot birga, fayl o‘zgarsa qayta yuklanadi |
| `npm run dev -w @edugen/worker` | faqat worker (`@edugen/bot` — faqat bot) |
| `npm start` | worker + bot (prod rejimi, qayta yuklashsiz) |
| `npm test` | barcha testlar (integratsion testlar uchun `npm run db:up` kerak) |
| `npm run typecheck` | TypeScript tekshiruvi |

Interfeysning kirillcha matnlari alohida yozilmaydi — ular `uz-latn` matnlaridan avtomatik o‘giriladi.

---

## 🧪 20. TESTLAR

- `shared`: zod sxemalar, promptlar, **zaxira AI router**, **translit** (ikki tomonlama namunalar),
  generatorlar (PDF/DOCX/PPTX yaroqliligi), limitlar, versiyalar
- `worker`: idempotentlik, xatoda limit qaytarilishi
- `backend`: endpointlar, auth, egalik, `409 CONFLICT`, ulashish havolalari
- `bot`: oqim holatlari, `/settings`, `/convert`
- Haqiqiy AI testlarda chaqirilmaydi. CI: lint → test → build

---

## 🚀 21. DEPLOY

| Qism | Platforma |
|------|-----------|
| `web` | Vercel |
| `backend`, `worker`, `bot` | Railway / Render (uchta alohida servis) |
| Redis | Railway Redis / Render Key Value (`noeviction`) |
| MongoDB | MongoDB Atlas |

Bot prod’da webhook bilan ishlaydi; worker’larni bir nechta instansga ko‘paytirish mumkin.

---

## 🗺 22. ROADMAP

**Bosqich 1 — MVP (bot)**
- [x] Monorepo, `shared` yadro, MongoDB, AI provayder interfeysi
- [x] Esse, taqdimot, mustaqil ish + PDF / DOCX / PPTX
- [x] Navbat (BullMQ + Redis) va worker
- [x] Telegram bot, kunlik limit, til/yozuv sozlamalari
- [x] Lotin ↔ kirill (bot)
- [ ] Haqiqiy token va OpenAI kaliti bilan sinov
- [ ] Deploy

**Bosqich 2 — Web**
- [ ] Kirish, dashboard, editor, `/settings`, `/convert`
- [ ] AI tugmalari, versiyalar tarixi
- [ ] Taqdimot rejimi va ulashish
- [ ] Zaxira AI, Minimal va Dark shablonlar

**Bosqich 3 — Boshqaruv**
- [ ] Admin panel

**Bosqich 4 — Kelajak**
- [ ] 🔥 PDF dizayn tizimi, PPTX murakkab layout va rasmlar
- [ ] 🔥 AI auto-design, template marketplace
- [ ] 🔥 To‘liq Canva-style erkin editor
- [ ] OTM va maktablar uchun SaaS

---

## ⚠️ 23. CHEKLOVLAR

- AI matni xato bo‘lishi mumkin — natijani tekshiring, ayniqsa **adabiyotlar ro‘yxatini**
- Lotin ↔ kirill qoidalarga asoslangan — lug‘atda yo‘q o‘zlashma so‘zlarda xato bo‘lishi mumkin
- Platforma — o‘quv jarayoniga yordamchi; ta’lim muassasangizning akademik halollik qoidalariga amal qiling

---

**EduGen AI — AI + Design + Automation 🚀**
