// Source of truth for UI texts. uz-cyrl is derived from this file by transliteration.
// {placeholders}, HTML tags and /commands are kept as-is by the transliterator.
export const uzLatn = {
  welcome:
    "Assalomu alaykum, {name}! 👋\n\nMen <b>EduGen AI</b> — esse, taqdimot, mustaqil ish va dokladlarni bir necha daqiqada tayyorlab beraman.\n\nPastdagi menyudan tanlang yoki /new buyrug‘ini yuboring.",

  "menu.new": "📝 Yangi hujjat",
  "menu.report": "🎤 Doklad yaratish",
  "menu.history": "🗂 Hujjatlarim",
  "menu.convert": "🔤 Lotin ↔ Kirill",
  "menu.settings": "⚙️ Sozlamalar",
  "menu.plan": "💎 Tarif",
  "menu.help": "❓ Yordam",

  "type.essay": "📝 Esse",
  "type.presentation": "📊 Taqdimot",
  "type.work": "📚 Mustaqil ish",
  "type.report": "🎤 Doklad",

  "new.chooseType": "Nima tayyorlaymiz?",
  "new.askTopic": "{type} mavzusini yozing.\n\nMasalan: <i>Sun’iy intellektning ta’limdagi o‘rni</i>",
  "new.topicInvalid": "Mavzu {min} dan {max} belgigacha bo‘lishi va so‘zlardan iborat bo‘lishi kerak. Qaytadan yozing:",
  "new.chooseLength.words": "Hajmini tanlang:",
  "new.chooseLength.slides": "Nechta slayd bo‘lsin?",
  "new.chooseLength.pages": "Necha bet bo‘lsin? (titul varaq va rejadan tashqari)",
  "unit.words": "{n} so‘z",
  "unit.slides": "{n} slayd",
  "unit.pages": "{n} bet",
  "new.askMeta":
    "Titul varaq uchun ma’lumotlarni nusxalab, to‘ldirib yuboring (keraksiz qatorlarni o‘chiring):\n\n<code>OTM: \nFakultet: \nFan: \nTalaba: \nGuruh: \nO‘qituvchi: \nShahar: </code>\n\nYoki «O‘tkazib yuborish»ni bosing.",
  "new.metaEmpty": "Hech qanday ma’lumot topilmadi. Namunadagidek «Nom: qiymat» ko‘rinishida yuboring yoki «O‘tkazib yuborish»ni bosing.",
  "new.chooseTemplate": "Dizayn shablonini tanlang:",
  "new.confirm":
    "Tekshirib oling:\n\n📄 Tur: {type}\n📝 Mavzu: <b>{topic}</b>\n🌐 Til: {language}\n📏 Hajm: {length}\n🎨 Shablon: {template}{meta}",
  "new.confirmMeta": "\n🎓 Titul:\n{fields}",
  "new.edit": "✏️ Tahrirlash",
  "new.useButtons": "Iltimos, yuqoridagi tugmalardan birini tanlang. Bekor qilish: /cancel",
  "edit.choose": "Nimani o‘zgartiramiz?",
  "edit.topic": "📝 Mavzu",
  "edit.length": "📏 Hajm",
  "edit.meta": "🎓 Titul",
  "edit.template": "🎨 Shablon",
  "meta.university": "OTM",
  "meta.faculty": "Fakultet",
  "meta.subject": "Fan",
  "meta.student": "Talaba",
  "meta.group": "Guruh",
  "meta.teacher": "O‘qituvchi",
  "meta.city": "Shahar",
  "meta.year": "Yil",
  "new.create": "✅ Yaratish",
  "new.changeLanguage": "🌐 Tilni o‘zgartirish",
  "new.chooseLanguage": "Bu hujjat qaysi tilda bo‘lsin?",
  "new.expired": "Bu tanlov eskirgan. /new — qaytadan boshlash.",

  "gen.queued": "⏳ Navbatga qo‘yildi. Tayyor bo‘lishi bilan yuboraman…",
  "gen.progress": "✍️ Tayyorlanmoqda… {percent}%\n{stage}",
  "gen.ready": "✅ Tayyor!",
  "gen.done": "✅ <b>{title}</b>\n\n{preview}",
  "gen.chooseFormat": "Qaysi formatda yuboray?",
  "gen.referencesWarning": "⚠️ Adabiyotlar ro‘yxatini albatta tekshiring — AI mavjud bo‘lmagan manbani yozib qo‘yishi mumkin.",
  "gen.failed": "😔 Hujjatni yaratib bo‘lmadi. Limitingiz qaytarildi — birozdan keyin qayta urinib ko‘ring.",
  "gen.alreadyRunning": "⏳ Oldingi hujjat hali tayyorlanmoqda — u tugashini kuting.",
  "gen.limitExceeded": "Bugungi limit tugadi ({limit} ta hujjat). Limit har kuni 00:00 da (Toshkent vaqti) yangilanadi.",

  "stage.writing": "Matn yozilmoqda",
  "stage.outline": "Reja tuzilmoqda",
  "stage.chapter": "{n}/{total}-bob yozilmoqda",
  "stage.section": "{n}/{total}-bo‘lim yozilmoqda",
  "stage.final": "Kirish, xulosa va adabiyotlar",

  "btn.regenerate": "🔁 Qayta yaratish",
  "btn.retry": "🔁 Qayta urinish",
  "btn.readText": "📖 Matnni o‘qish",
  "btn.toCyrillic": "🔤 Кириллча",
  "btn.toLatin": "🔤 Lotincha",
  "btn.skip": "⏭ O‘tkazib yuborish",
  "btn.cancel": "❌ Bekor qilish",
  "btn.back": "⬅️ Orqaga",

  "export.preparing": "⏳ {format} tayyorlanmoqda…",
  "export.failed": "Faylni tayyorlashda xatolik. Qayta urinib ko‘ring.",
  "export.failedText": "Faylni tayyorlashda xatolik. Qayta urinib ko‘ring yoki «📖 Matnni o‘qish» tugmasi orqali matnni oling.",
  "text.reminder": "⚠️ Topshirishdan oldin faktlarni va universitet format talablarini tekshiring.",

  "convert.ask": "🔤 Lotin yoki kirill yozuvidagi matnni yuboring — boshqa yozuvga o‘girib beraman.\n\nChiqish: /cancel",
  "convert.noText": "Matn topilmadi. Oddiy matn yuboring.",
  "convert.asFile": "Matn uzun bo‘lgani uchun fayl sifatida yubordim.",
  "convert.notUzbek": "Bu hujjat o‘zbek tilida emas — yozuvini o‘girib bo‘lmaydi.",

  "settings.title":
    "⚙️ <b>Sozlamalar</b>\n\n🗣 Interfeys tili: {ui}\n🌐 Hujjatlar tili: {content}\n🎨 Standart shablon: {template}",
  "settings.ui": "🗣 Interfeys tili",
  "settings.content": "🌐 Hujjatlar tili",
  "settings.template": "🎨 Shablon",
  "settings.saved": "✅ Saqlandi",
  "settings.chooseUi": "Interfeys tilini tanlang:",
  "settings.chooseContent": "Hujjatlar qaysi tilda yozilsin? (har bir hujjat uchun alohida ham o‘zgartirsa bo‘ladi)",
  "settings.chooseTemplate": "Standart shablonni tanlang:",

  "history.empty": "Hali hujjatlaringiz yo‘q. /new — birinchisini yaratish.",
  "history.title": "🗂 Oxirgi hujjatlaringiz:",

  "plan.info":
    "💎 Tarif: <b>Bepul</b> — barcha shablon va imkoniyatlar ochiq.\n\nBugun qoldi: <b>{left}</b> / {limit} ta hujjat\n\nLimit har kuni 00:00 da (Toshkent vaqti) yangilanadi.",

  help:
    "<b>EduGen AI</b> — esse, taqdimot, mustaqil ish va doklad tayyorlaydi.\n\n/new — yangi hujjat\n/report — doklad\n/history — oxirgi hujjatlarim\n/convert — lotin ↔ kirill\n/settings — til, yozuv va shablon\n/plan — tarif va limit\n/cancel — joriy amalni bekor qilish\n\n⚠️ AI xato qilishi mumkin — natijani tekshirib chiqing.",
  cancelled: "Bekor qilindi. /new — yangi hujjat.",
  idleHint: "Yangi hujjat uchun /new buyrug‘ini yuboring yoki menyudan tanlang.",
  notFound: "Hujjat topilmadi.",
  error: "Kutilmagan xatolik yuz berdi. Birozdan keyin qayta urinib ko‘ring.",

  "cmd.start": "Boshlash",
  "cmd.new": "Yangi hujjat yaratish",
  "cmd.report": "Doklad yaratish",
  "cmd.history": "Oxirgi hujjatlarim",
  "cmd.convert": "Lotin ↔ kirill o‘girish",
  "cmd.settings": "Til, yozuv va shablon",
  "cmd.plan": "Tarif va qolgan limit",
  "cmd.help": "Yordam",
  "cmd.cancel": "Bekor qilish",
} as const;

export type MessageKey = keyof typeof uzLatn;
export type Messages = Record<MessageKey, string>;
