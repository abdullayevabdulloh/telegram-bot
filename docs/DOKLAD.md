# 🎤 Doklad — EduGen botiga yangi hujjat turi (implementatsiya topshirig‘i)

> EduGen botiga **“Doklad”** hujjat turini qo‘shish bo‘yicha topshiriq. U loyihaning mavjud arxitekturasi
> ([README.md](../README.md), [SPEC.md](SPEC.md)) asosida yozilgan.
> Doklad **alohida modul emas**, balki to‘rtinchi hujjat turi (`DocType = "report"`). U “📚 Mustaqil ish”
> bilan bir xil yo‘ldan o‘tadi: navbat, worker, AI router, limitlar, DOCX/PDF eksport.
> Mavjud turlar, menyu, callback’lar va ma’lumotlar bazasi o‘zgarmasdan ishlashda davom etadi.

---

## 0. Asl topshiriqdan nimasi o‘zgardi va nega

| Asl topshiriqda | Muammo | Bu hujjatda |
|---|---|---|
| “Stekni aniqlang” — umumiy shablon | Stek ma’lum: Telegraf v4 + Mongo session, BullMQ worker, OpenAI + Claude zaxira, zod, `docx`/`pdfkit` | Aniq fayllar va funksiyalar ko‘rsatilgan |
| Alohida `report.*` modul, alohida LLM chaqiruvi, alohida JSON | “Mustaqil ish” pipeline’ini (reja → boblar → kirish/xulosa/adabiyotlar) takrorlaydi; zaxira AI, limit, progress, tarix yangi modulda bo‘lmaydi | `DOC_TYPES`ga `report` qo‘shiladi, `generateWork` parametrlanadi |
| `📝 Doklad yaratish` | `📝` belgisi allaqachon “📝 Yangi hujjat”, “📝 Esse” va “📝 DOCX”da ishlatilgan | `🎤 Doklad` |
| Til har safar so‘raladi (8-qadam); kodlar `uz-Latn`, `uz-Cyrl` | Loyihada hujjat tili `/settings`da bir marta tanlanadi, tasdiqlashda “🌐 Tilni o‘zgartirish” bor; kodlar `uz-latn`, `uz-cyrl`, `ru`, `en` | Alohida til qadami yo‘q, mavjud mexanizm ishlatiladi |
| Titul uchun 5 ta alohida savol, `institution` = universitet + fakultet | Mavjud `TitleMeta`da `university` va `faculty` alohida maydonlar. 5 qadam ortiqcha bosish talab qiladi | Mavjud bitta xabarli titul formasi (`parseTitleMeta`) |
| Titul ma’lumotlari (F.I.Sh.) LLM promptiga yuboriladi, `title_page`ni AI yozadi | Shaxsiy ma’lumot uchinchi tomon AI’ga ketadi; AI titulga uydirma yozishi mumkin; README: “titul AI’dan emas, foydalanuvchidan” | Titul ma’lumotlari AI’ga **yuborilmaydi**, titulni eksport chizadi |
| Ichki prompt o‘zbekcha, alohida JSON sxema | Mavjud promptlar inglizcha, til qoidalari `LANGUAGE_RULES`da; kirillcha hujjat lotinda yozilib translit qilinadi | Mavjud `systemPrompt` + yangi `report*` user-promptlar |
| “Faqat tekshirilgan manbalar” | Modelda internet yo‘q, manbani tekshira olmaydi — talabni bajarib bo‘lmaydi | “Ishonchi komil bo‘lmasa yozma” + foydalanuvchiga majburiy ogohlantirish |
| Sahifa: 2–20, `Boshqa` bilan qo‘lda kiritish | 2 betda kirish + 2 bo‘lim + xulosa + adabiyot sig‘maydi; 10+ bet — bu mustaqil ish. Boshqa turlarda erkin kiritish yo‘q | 3–10 bet, tugmalar `3 / 5 / 7 / 10` |
| 1 bet ≈ 250–350 so‘z | Loyihada `WORDS_PER_PAGE = 270` | Shu konstanta ishlatiladi |
| 10 ta yangi `REPORT_*` state, `REPORT_GENERATING` | Mavjud `Step`lar yetarli (tur `session.type`da). Generatsiya holati MongoDB’da (`generations.status`) | Yangi state yo‘q (faqat tahrirlash belgisi) |
| Natija Telegram’ga to‘liq matn bo‘lib avtomatik yuboriladi | 5 bet = 6–8 ta xabar. Loyihada natija “preview + format tugmalari” ko‘rinishida | DOCX/PDF tugmalari + yangi “📖 Matnni o‘qish” tugmasi (bo‘laklab yuboradi) |
| Fayl nomi `doklad_<slug>_<YYYY-MM-DD>.docx` | Mavjud konvensiya: `<slug>_<tur>.<format>` | `<slug>_doklad.docx` |
| `LLM_API_KEY`, `REPORT_MAX_PAGES` va boshqa yangi env | Kalitlar `OPENAI_*` / `ANTHROPIC_*`; chegaralar kodda (`LENGTH_RULES`, `shared/limits`) | Yangi env o‘zgaruvchi **yo‘q** |
| Guruh chatlari uchun state | Bot faqat shaxsiy chatlarda ishlaydi (`bot.ts` middleware) | Talab olib tashlandi |
| “Formatter, linter” | Loyihada faqat `tsc` va Vitest bor | `npm run typecheck`, `npm test` |
| Kunlik limit haqida hech narsa yo‘q | Har generatsiya kunlik limitdan (50) bitta oladi | Doklad ham 1 generatsiya hisoblanadi |
| Xato bo‘lsa “qayta urinish” | Hozir `gen.failed` xabarida tugma yo‘q | Xato xabariga `🔁 Qayta urinish` tugmasi qo‘shiladi |

---

## 1. Foydalanuvchi oqimi

### Kirish nuqtalari

1. **“📝 Yangi hujjat” → tur tanlash** ro‘yxatida yangi qator: `🎤 Doklad` (callback `t:report`).
2. **Bosh menyuda tezkor tugma** `🎤 Doklad yaratish`. U birinchi qatorga “📝 Yangi hujjat” yoniga qo‘yiladi
   va tur tanlashni o‘tkazib, to‘g‘ridan-to‘g‘ri mavzu so‘rash bosqichiga o‘tadi.

```text
[📝 Yangi hujjat] [🎤 Doklad yaratish]
[🗂 Hujjatlarim]  [🔤 Lotin ↔ Kirill]
[⚙️ Sozlamalar]   [💎 Tarif] [❓ Yordam]
```

Ikkala yo‘l ham bir xil handler’ga olib keladi. Mavjud tugma va callback’lar o‘zgarmaydi.

### Suhbat (Mustaqil ish bilan bir xil)

```text
🎤 Doklad
  → mavzu (majburiy)
  → hajm: [3 bet] [5 bet] [7 bet] [10 bet]       (titul varaq va rejadan tashqari)
  → titul ma’lumotlari: bitta xabar yoki [⏭ O‘tkazib yuborish]
  → shablon
  → tasdiqlash: [✅ Yaratish] [✏️ Tahrirlash] [🌐 Tilni o‘zgartirish] [❌ Bekor qilish]
  → ⏳ navbatda… → ✍️ 2/3-bo‘lim… → natija
```

- Mavzu so‘rovi: `new.askTopic` matni, `{type}` = “Doklad”.
  Misol: *Sun’iy intellektning ta’limdagi o‘rni*.
- **Titul formasi** — mavjud `new.askMeta`. Foydalanuvchi namunani nusxalab to‘ldiradi:
  `OTM / Fakultet / Fan / Talaba / Guruh / O‘qituvchi / Shahar`. Lotin, kirill va rus yorliqlari qabul qilinadi.
  To‘ldirilmagan qatorlar titulga chiqmaydi.
- **Til** alohida so‘ralmaydi. Standart qiymat — `user.settings.contentLanguage`. Shu hujjat uchun boshqa
  tilni tasdiqlash ekranidagi “🌐 Tilni o‘zgartirish” orqali tanlash mumkin (`uz-latn`, `uz-cyrl`, `ru`, `en`).
- **Bekor qilish** har qadamda bor (inline `❌ Bekor qilish`, `/cancel`, istalgan menyu tugmasi yoki buyruq).

### Tasdiqlash ekrani

```text
Tekshirib oling:

📄 Tur: 🎤 Doklad
📝 Mavzu: Sun’iy intellektning ta’limdagi o‘rni
🌐 Til: O‘zbekcha (lotin)
📏 Hajm: 5 bet
🎨 Shablon: Minimal
🎓 Titul:                            ← faqat to‘ldirilgan maydonlar (escape qilingan); bo‘lmasa qator yo‘q
• OTM: TDIU
• Fan: Informatika
```

`🎓 Titul` qatori yangi `{meta}` parametri bilan qo‘shiladi. Mustaqil ish ekranida ham ko‘rinadi, boshqa turlarda bo‘sh qoladi.

### ✏️ Tahrirlash (yangi, barcha turlar uchun)

`✏️ Tahrirlash` → `[📝 Mavzu] [📏 Hajm] [🎓 Titul] [🎨 Shablon] [⬅️ Orqaga]`.
Tanlangan qadam qayta so‘raladi, keyin to‘g‘ridan-to‘g‘ri tasdiqlash ekraniga qaytiladi, qolgan qiymatlar saqlanadi.
Amalga oshirish: `BotSession`ga `editing?: boolean` qo‘shiladi. `editing` bo‘lsa, `handleCreateText`, `l:`,
`meta:skip` va `tpl:` handler’lari keyingi qadam o‘rniga `showConfirm` chaqiradi. Titul faqat `work` va
`report`da ko‘rsatiladi, esse/taqdimotda tahrirlash menyusida bo‘lmaydi.

---

## 2. O‘zgaradigan fayllar

| Fayl | O‘zgarish |
|---|---|
| `shared/src/schema/index.ts` | `DOC_TYPES`ga `"report"`; `LENGTH_RULES.report = { unit: "pages", default: 5, min: 3, max: 10, presets: [3, 5, 7, 10] }`; `FORMATS_BY_TYPE.report = ["docx", "pdf"]`; yordamchi `hasTitlePage(type)` → `work \| report` |
| `shared/src/ai/prompts.ts` | `reportOutlinePrompt`, `reportFinalPrompt`; `reportSectionCount(pages)`: ≤5 bet → 2, aks holda 3 bo‘lim |
| `shared/src/ai/generate.ts` | `generateWork` parametrlanadi (`kind: "work" \| "report"`): prompt, bo‘limlar soni, `content.type`. Esse/taqdimot/mustaqil ish kodi o‘zgarmaydi |
| `shared/src/export/common.ts` | `TYPE_SUFFIX.report = "doklad"` |
| `shared/src/export/docx.ts`, `pdf.ts` | `content.type === "work"` → `hasTitlePage(content.type)`; titulda `s.work` o‘rniga tur bo‘yicha sarlavha (`s.report`) |
| `shared/src/i18n/index.ts` (`docStrings`) | `report`: `DOKLAD` / `ДОКЛАД` / `ДОКЛАД` / `REPORT` |
| `shared/src/i18n/locales/uz-latn.ts`, `ru.ts` | `type.report`, `menu.report`, `btn.edit`, `btn.readText`, `edit.*`, `new.confirm`dagi `{meta}`, `gen.failed` tugmasi uchun matnlar. `uz-cyrl` avtomatik translit qilinadi |
| `shared/src/telegram/index.ts` | `doneText`: adabiyotlar ogohlantirishi `work \| report` uchun; `resultKeyboard`: `📖 Matnni o‘qish` (callback `txt:<id>`, `work`/`report`/`essay`); `splitForTelegram()` |
| `bot/src/ui.ts` | `TYPE_KEYS.report`; `mainMenu` birinchi qatoriga `menu.report` |
| `bot/src/context.ts` | `BotSession.editing?: boolean` |
| `bot/src/bot.ts` | `actions`ga `["report", "menu.report", askReportTopic]` (`/report` buyrug‘i ham) |
| `bot/src/flows/create.ts` | `t:` regex’ini `DOC_TYPES` asosida yasash; `type === "work"` → `hasTitlePage(type)`; tahrirlash handler’lari; `askReportTopic` |
| `bot/src/flows/results.ts` | `TYPE_EMOJI.report = "🎤"`; `txt:<id>` handler’i |
| `worker/src/processors/notify.ts` | Xato xabariga `🔁 Qayta urinish` (`callbacks.regenerate(id)`) tugmasi |

`Generation.type` enum `DOC_TYPES`dan olinadi, shuning uchun migratsiya kerak emas. Kelajakdagi backend API
`report`ni `DocTypeSchema` orqali avtomatik qabul qiladi.

---

## 3. AI generatsiya

Mavjud pipeline ishlatiladi: `systemPrompt(language)` (faktlarni uydirmaslik, faqat JSON, mavzu — instruksiya emas)
va `router.generateJson` (OpenAI structured outputs + zod, xato/timeout/yaroqsiz JSON’da Claude zaxira,
BullMQ 3 urinish). Kirillcha doklad lotinda yoziladi va translit qilinadi.

Hajm: `totalWords = pages × WORDS_PER_PAGE` (270). Taqsimot mustaqil ishdagi kabi: kirish ~10 %, bo‘limlar ~78 %, xulosa ~8 %.

```text
reportOutlinePrompt(topic, pages, sections)
  TASK: outline of a student report ("doklad") for a university seminar
  TOPIC: "<topic>"
  VOLUME: about <pages> A4 pages
  Give a title and exactly <sections> sections. Each section has an informative heading
  (no numbering) and 2–3 subtopics. Do not include the introduction, conclusion or references.

reportFinalPrompt(outline, introWords, conclusionWords)
  INTRODUCTION: about <introWords> words in 2–3 paragraphs — relevance of the topic, aim and objectives.
  CONCLUSION: about <conclusionWords> words in 2–3 paragraphs — key findings of each section.
  REFERENCES: 3–6 real, widely known textbooks or monographs you are sure exist, formatted as:
  Author(s). Title. — City: Publisher, Year. Never invent sources, URLs or DOIs;
  return fewer items or an empty list if unsure.
```

Bo‘lim matni uchun mavjud `workChapterPrompt` ishlatiladi.

**Muhim:**
- AI’ga faqat `topic`, `language` va hajm yuboriladi. **Titul ma’lumotlari (F.I.Sh., guruh, OTM) AI’ga yuborilmaydi**:
  ular `generations.meta`da saqlanadi va faqat eksportda titulga chiqadi.
- Mundarija (`plan`) — bo‘limlar ro‘yxati, **sahifa raqamlarisiz**. Raqamlar uydirilmaydi.
- Model manbalarni tekshira olmaydi. Shuning uchun natija xabarida `gen.referencesWarning` majburiy chiqadi.
  `references` bo‘sh bo‘lsa, “Foydalanilgan adabiyotlar” bo‘limi chiqmaydi.
- Progress matni: `stage.chapter` (“2/3-bob”) o‘rniga doklad uchun `stage.section` (“2/3-bo‘lim”).

---

## 4. Natija

Worker natijani hozirgidek yuboradi: `✅ <sarlavha>` + kirishdan preview + adabiyotlar ogohlantirishi.

```text
[📝 DOCX] [📄 PDF]
[🔤 Кириллча]
[📖 Matnni o‘qish]
[🔁 Qayta yaratish]
```

- **DOCX/PDF** — mavjud eksport: A4, Times New Roman 14 pt, 1.5 interval, hoshiyalar 3 / 1.5 / 2 / 2 sm.
  Titul alohida sahifada, keyin reja, bo‘limlar va adabiyotlar. Titul sahifasida sahifa raqami yo‘q.
  Titulda: OTM, fakultet, **“DOKLAD”**, fan, mavzu, bajardi/guruh/tekshirdi, shahar va yil
  (to‘ldirilgan maydonlargina). Universitetning qat’iy shabloni da’vo qilinmaydi.
- **📖 Matnni o‘qish** (`txt:<id>`, egalik `findOwnedGeneration` bilan tekshiriladi) Telegram’ga yuboradi:
  sarlavha → bo‘limlar → xulosa → adabiyotlar → “Topshirishdan oldin faktlar va universitet format talablarini tekshiring.”
  - `splitForTelegram(text, 3500)`: avval paragraf chegarasida, sig‘masa gap, oxirgi chora sifatida bo‘sh joy bo‘yicha bo‘ladi.
    Har bo‘lak alohida `escapeHtml` qilinadi, shuning uchun bo‘lak o‘rtasida teg yoki entity uzilmaydi.
  - Xabarlar ketma-ket yuboriladi. `429` bo‘lsa `retry_after` kutiladi.
- Eksport xato bersa, `export.failed` matniga “📖 Matnni o‘qish orqali matnni olishingiz mumkin” qo‘shiladi.
  Natija foydalanuvchida baribir qoladi.
- Fayl nomi: `<slug>_doklad.docx` (mavjud `fileName()`).

---

## 5. Validatsiya

| Maydon | Qoida | Qayerda |
|---|---|---|
| Mavzu | bo‘shliqlar siqiladi, 3–200 belgi (`TopicSchema`). **Qo‘shimcha:** kamida 3 ta harf yoki raqam bo‘lsin (`/[\p{L}\p{N}]/u`), faqat emoji yoki tinish belgisi rad etiladi. Bu barcha turlar uchun foydali | `shared/schema` |
| Titul | `parseTitleMeta`: noma’lum yorliq o‘tkazib yuboriladi, uzunlik `TitleMetaSchema` bo‘yicha (200 / guruh 50 / shahar 100). **Qo‘shimcha:** qiymatdan boshqaruv belgilari (`\p{Cc}`) olib tashlanadi | `shared/schema/meta.ts` |
| Hajm | faqat `l:<n>` callback va `lengthPresets(type)`dagi qiymat; `startGeneration`da `clampLength` | mavjud |
| Til | faqat `cl:(uz-latn\|uz-cyrl\|ru\|en)` callback | mavjud |
| HTML | foydalanuvchi va AI matni Telegram’ga faqat `escapeHtml` orqali boradi | mavjud + `txt:` |

Kutilgan joyda tugma o‘rniga matn yuborilsa, joriy qadam saqlanadi va qisqa izoh beriladi
(`new.useButtons`: “Iltimos, tugmalardan birini tanlang”).

---

## 6. Holat, takroriy bosish va xatolar

- **State** — mavjud `BotSession` (MongoDB, 30 kun TTL, kalit — foydalanuvchi). Yangi `Step` qo‘shilmaydi.
  Tur `session.type = "report"`da turadi.
- **Eskirgan tugma yoki sessiya** — mavjud `new.expired` (“Bu tanlov eskirgan. /new — qaytadan boshlash.”).
- **Takroriy “Yaratish”** — `dropButtons` (tugmalar o‘chiriladi) va `startGeneration`dagi
  `AlreadyGeneratingError` (foydalanuvchida `pending` generatsiya bo‘lsa yangisi yaratilmaydi).
  *Ixtiyoriy mustahkamlash:* `generations`da `{ userId: 1 }` bo‘yicha `partialFilterExpression: { status: "pending" }`
  bilan unique indeks. Bunda ikki parallel so‘rov ham `E11000` → `AlreadyGeneratingError` bo‘ladi.
- **AI xatosi yoki timeout** — router zaxiraga o‘tadi, BullMQ qayta urinadi. Oxiri `failed` bo‘lsa, limit qaytariladi
  va foydalanuvchi `gen.failed` + **🔁 Qayta urinish** tugmasini oladi. Barcha parametrlar `generations`da
  saqlangani uchun ma’lumot yo‘qolmaydi.
- **Kunlik limit** — doklad = 1 generatsiya (`gen.limitExceeded`).
- **Loglar** — faqat `generationId`, tur, provayder va tokenlar. `topic`, `meta` (F.I.Sh.), bot tokeni va
  API kalitlari logga **yozilmaydi**. Yangi `logger.*` chaqiruvlariga `session` yoki `generation` obyekti to‘liq berilmaydi.

---

## 7. Konfiguratsiya

Yangi environment o‘zgaruvchi **kerak emas**: AI kalitlari va modellari mavjud `OPENAI_*` va `ANTHROPIC_*`,
hajm chegaralari `LENGTH_RULES.report`da, kunlik limit `shared/limits`da.

---

## 8. Testlar (Vitest, AI mock’lanadi — `ai.test.ts`dagi kabi soxta `AIRouter`)

- `schema`: `report` `DOC_TYPES`, `LENGTH_RULES` va `FORMATS_BY_TYPE`da bor; mavzu validatsiyasi
  (`"!!!"`, `"😀😀😀"`, 201 belgi rad etiladi; `"AI ta’limda"` qabul qilinadi).
- `ai`: `generateDocument({ type: "report", length: 5 })` → `type: "report"`, 2 bo‘lim, `plan` = kirish +
  bo‘limlar + xulosa (+ adabiyotlar); prompt matnida titul ma’lumotlari **yo‘q**; `uz-cyrl` translit qilinadi;
  bo‘sh `references` → `undefined`.
- `export`: `report` uchun DOCX va PDF yaratiladi; titulda “DOKLAD” va faqat to‘ldirilgan maydonlar;
  PPTX so‘ralsa xato; fayl nomi `_doklad.docx`.
- `telegram`: `splitForTelegram` — har bo‘lak ≤ 3500, tartib saqlanadi, paragraf chegarasida bo‘linadi,
  juda uzun paragraf ham bo‘linadi; `<b>&` escape qilinadi.
- `bot` (`bot.test.ts` uslubida): menyuda `🎤 Doklad yaratish` (3 UI tilida); `t:report` → mavzu → `l:5` →
  titul formasi → `meta:skip` → shablon → tasdiqlash; `✏️ Tahrirlash` → mavzu → tasdiqlashga qaytish,
  boshqa qiymatlar saqlangan; `cancel` va `/cancel` sessiyani tozalaydi; eskirgan `l:`/`go` → `new.expired`;
  `go` ikki marta → bitta generatsiya.
- `worker`: xato bo‘lgan doklad uchun xabarda `rg:<id>` tugmasi bor.

Tekshiruv buyruqlari:

```bash
npm run typecheck
```

```bash
npm test
```

---

## 9. Qabul qilish mezonlari

- [ ] Esse, taqdimot, mustaqil ish, tarix, konvertor va sozlamalar o‘zgarishsiz ishlaydi (mavjud testlar o‘tadi).
- [ ] Bosh menyuda `🎤 Doklad yaratish`, “Yangi hujjat”da `🎤 Doklad` bor (uz-latn, uz-cyrl, ru).
- [ ] Mavzu majburiy; titul ixtiyoriy va bitta xabar bilan to‘ldiriladi; bo‘sh maydon titulga chiqmaydi.
- [ ] Hajm 3 / 5 / 7 / 10 bet (standart 5), til standart bo‘yicha sozlamalardan olinadi va tasdiqlashda o‘zgartiriladi.
- [ ] Tasdiqlash ekranida Yaratish, Tahrirlash, Tilni o‘zgartirish va Bekor qilish bor.
- [ ] DOCX/PDF: titul (“DOKLAD”), reja, kirish, 2–3 bo‘lim, xulosa, adabiyotlar.
- [ ] Titul ma’lumotlari AI’ga yuborilmaydi va logga yozilmaydi.
- [ ] Adabiyotlar haqida ogohlantirish chiqadi; sahifa raqamlari va manbalar uydirilmaydi.
- [ ] “📖 Matnni o‘qish” uzun matnni Telegram limitidan oshirmay, tartibni saqlab yuboradi.
- [ ] Xato bo‘lsa limit qaytariladi va “🔁 Qayta urinish” tugmasi chiqadi; takroriy bosish dublikat yaratmaydi.
- [ ] `npm run typecheck` va `npm test` muvaffaqiyatli.

---

## 10. Qo‘lda tekshirish

1. `npm run db:up`, so‘ng `npm run dev`.
2. Botda `🎤 Doklad yaratish` → mavzu: `Sun’iy intellektning ta’limdagi o‘rni`.
3. `5 bet` → titul formasiga faqat `OTM:` va `Fan:` qatorlarini yozing → shablon `Minimal`.
4. Tasdiqlashda `✏️ Tahrirlash → 📝 Mavzu` orqali mavzuni o‘zgartiring va boshqa qiymatlar saqlanganini tekshiring.
5. `✅ Yaratish` ni ketma-ket ikki marta bosing — faqat bitta “⏳ Navbatga qo‘yildi” chiqishi kerak.
6. Natijada `📝 DOCX` ni oching: titulda faqat OTM, “DOKLAD”, fan, mavzu va yil bo‘lsin. Talaba va o‘qituvchi qatorlari bo‘lmasin.
7. `📖 Matnni o‘qish` — bo‘limlar tartibda, har xabar to‘liq, oxirida eslatma bor.
8. `🔤 Кириллча` — doklad kirillchada nusxalanadi va DOCX’da ham kirillcha chiqadi.
9. Yangi oqimda mavzu sifatida `!!!` va 250 belgilik matn yuboring — tushunarli xato chiqib, qadam saqlanishi kerak.
10. Hajm bosqichida tugma o‘rniga `abc` yozing — “tugmalardan birini tanlang” izohi chiqishi kerak.
11. Istalgan qadamda `❌ Bekor qilish` va `/cancel` — bot bosh menyuga qaytadi.
12. `OPENAI_API_KEY`ni noto‘g‘ri qilib (zaxira o‘chirilgan holda) yarating — “Qayta urinish” tugmali xato chiqadi va kunlik limit kamaymaydi.
