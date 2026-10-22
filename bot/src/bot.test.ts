// Drives the bot with fake Telegram updates; API calls are captured instead of sent.
// Needs MongoDB and Redis from docker compose (`npm run db:up`).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BotSession, connectDb, disconnectDb, ensureIndexes, Generation, mongoose, User } from "@edugen/shared/db";
import { closeQueues } from "@edugen/shared/queue";
import { Telegram } from "telegraf";
import type { Update } from "telegraf/types";
import { createBot } from "./bot";
import { mainMenu } from "./ui";

type Call = { method: string; payload: Record<string, unknown> };

const CHAT = { id: 555, type: "private" as const, first_name: "Vali" };
const FROM = { id: 555, is_bot: false, first_name: "Vali", language_code: "uz" };

let calls: Call[] = [];
let updateId = 0;
let messageId = 100;
const bot = createBot("123:TEST");
bot.botInfo = { id: 1, is_bot: true, first_name: "EduGen", username: "EduGenUzBot" } as typeof bot.botInfo;
// handleUpdate builds a fresh Telegram client per update, so the prototype is patched.
Telegram.prototype.callApi = (async (method: string, payload: Record<string, unknown>) => {
  calls.push({ method, payload });
  if (method.startsWith("send")) return { message_id: ++messageId, date: 0, chat: CHAT, text: "" };
  return true;
}) as typeof Telegram.prototype.callApi;

async function send(text: string) {
  const entities = text.startsWith("/") ? [{ type: "bot_command" as const, offset: 0, length: text.split(" ")[0]!.length }] : undefined;
  calls = [];
  await bot.handleUpdate({
    update_id: ++updateId,
    message: { message_id: ++messageId, date: 0, chat: CHAT, from: FROM, text, entities },
  } as Update);
  return calls;
}

async function click(data: string) {
  calls = [];
  await bot.handleUpdate({
    update_id: ++updateId,
    callback_query: { id: String(updateId), from: FROM, chat_instance: "x", data, message: { message_id: messageId, date: 0, chat: CHAT, text: "…" } },
  } as Update);
  return calls;
}

const texts = (list: Call[]) => list.map((c) => String(c.payload.text ?? ""));
const buttons = (list: Call[]) =>
  list.flatMap((c) => ((c.payload.reply_markup as { inline_keyboard?: { callback_data: string }[][] })?.inline_keyboard ?? []).flat().map((b) => b.callback_data));

describe("bot conversation", () => {
  beforeAll(async () => {
    await connectDb();
    await mongoose.connection.dropDatabase();
    await ensureIndexes();
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Generation.deleteMany({}), BotSession.deleteMany({})]);
    await send("/start");
    await click("onb:uz-latn");
  });
  afterAll(async () => {
    await closeQueues();
    await disconnectDb();
  });

  it("asks a new user for the language first", async () => {
    await User.deleteMany({});
    const res = await send("/start");
    expect(texts(res)[0]).toContain("Tilni tanlang");
    expect(buttons(res)).toEqual(["onb:uz-latn", "onb:uz-cyrl", "onb:ru"]);

    const welcome = await click("onb:uz-cyrl");
    expect(texts(welcome).some((t) => t.startsWith("Ассалому алайкум, Vali"))).toBe(true);
    const user = await User.findOne({ telegramId: 555 }).lean();
    expect(user?.settings).toMatchObject({ uiLanguage: "uz-cyrl", contentLanguage: "uz-cyrl" });
  });

  it("walks through creating a presentation and queues it", async () => {
    expect(buttons(await send("/new"))).toContain("t:presentation");
    expect(texts(await click("t:presentation")).some((t) => t.includes("Taqdimot mavzusini"))).toBe(true);
    expect(texts(await send("ab"))[0]).toContain("3 dan 200");

    const lengths = await send("Sun'iy intellekt ta'limda");
    expect(buttons(lengths)).toEqual(["l:6", "l:8", "l:10", "l:12", "l:15", "l:20", "cancel"]);
    const templates = await click("l:10");
    expect(buttons(templates)).toEqual(["tpl:modern", "tpl:minimal", "tpl:dark", "tpl:aurora", "tpl:pastel", "cancel"]);

    const confirm = await click("tpl:modern");
    expect(texts(confirm).join("\n")).toContain("O‘zbekcha (lotin)");
    await click("chl");
    expect(texts(await click("cl:uz-cyrl")).join("\n")).toContain("Ўзбекча (кирилл)");

    const go = await click("go");
    expect(texts(go)).toContain("⏳ Navbatga qo‘yildi. Tayyor bo‘lishi bilan yuboraman…");
    const generation = await Generation.findOne().lean();
    expect(generation).toMatchObject({
      status: "pending",
      type: "presentation",
      topic: "Sun'iy intellekt ta'limda",
      language: "uz-cyrl",
      template: "modern",
      length: 10,
      botContext: { chatId: 555 },
    });

    // A second click on an old "create" button must not start another one
    const again = await click("go");
    expect(again.find((c) => c.method === "answerCallbackQuery")?.payload.text).toContain("eskirgan");
  });

  it("collects title-page data for an independent work", async () => {
    await send("/new");
    await click("t:work");
    const lengths = await send("Raqamli iqtisodiyot");
    expect(buttons(lengths)).toEqual(["l:6", "l:8", "l:10", "l:15", "l:20", "l:25", "cancel"]); // no paid plan: all lengths are open
    await click("l:25");
    await send("OTM: TDIU\nTalaba: Aliyev Vali\nGuruh: IQ-21");
    await click("tpl:dark"); // was Pro-only
    await click("go");
    const generation = await Generation.findOne().lean();
    expect(generation).toMatchObject({ template: "dark", length: 25 });
    expect(generation?.meta).toEqual({ university: "TDIU", student: "Aliyev Vali", group: "IQ-21" });
  });

  it("creates a report from the main-menu shortcut and edits it before creating", async () => {
    for (const lang of ["uz-latn", "uz-cyrl", "ru"] as const) {
      expect(JSON.stringify(mainMenu(lang).reply_markup.keyboard[0])).toMatch(/🎤/);
    }
    expect(buttons(await send("/new"))).toContain("t:report");

    expect(texts(await send("🎤 Doklad yaratish"))[0]).toContain("🎤 Doklad mavzusini");
    expect(texts(await send("!!!"))[0]).toContain("3 dan 200");
    const lengths = await send("Sun’iy intellektning ta’limdagi o‘rni");
    expect(texts(lengths)[0]).toContain("titul varaq va rejadan tashqari");
    expect(buttons(lengths)).toEqual(["l:3", "l:5", "l:7", "l:10", "cancel"]);
    expect(texts(await send("abc"))[0]).toContain("tugmalardan birini tanlang"); // the step is kept
    expect(buttons(await click("l:5"))).toEqual(["meta:skip", "cancel"]);
    await send("OTM: TDIU\nFan: Informatika");

    const confirm = texts(await click("tpl:minimal")).join("\n");
    expect(confirm).toContain("🎤 Doklad");
    expect(confirm).toContain("5 bet");
    expect(confirm).toContain("• OTM: TDIU\n• Fan: Informatika");
    expect(confirm).not.toContain("Talaba");

    expect(buttons(await click("edit"))).toEqual(["ed:topic", "ed:length", "ed:meta", "ed:template", "ed:back"]);
    expect(texts(await click("ed:topic")).some((t) => t.includes("mavzusini"))).toBe(true);
    const edited = texts(await send("Raqamli ta’lim")).join("\n");
    expect(edited).toContain("Tekshirib oling");
    expect(edited).toContain("Raqamli ta’lim");
    expect(edited).toContain("• OTM: TDIU"); // the other answers are kept

    await click("edit");
    await click("ed:length");
    expect(texts(await click("l:7")).join("\n")).toContain("7 bet");

    await click("go");
    const generation = await Generation.findOne().lean();
    expect(generation).toMatchObject({ type: "report", topic: "Raqamli ta’lim", length: 7, template: "minimal", status: "pending" });
    expect(generation?.meta).toEqual({ university: "TDIU", subject: "Informatika" });
    const again = await click("go");
    expect(again.find((c) => c.method === "answerCallbackQuery")?.payload.text).toContain("eskirgan");
    expect(await Generation.countDocuments()).toBe(1);
  });

  it("clears the title page when it is skipped while editing; essays have no title page to edit", async () => {
    await send("/report");
    await send("Raqamli iqtisodiyot");
    await click("l:3");
    await send("Talaba: Aliyev Vali");
    await click("tpl:modern");
    await click("edit");
    await click("ed:meta");
    expect(texts(await click("meta:skip")).join("\n")).not.toContain("Aliyev");
    await click("go");
    expect((await Generation.findOne().lean())?.meta).toEqual({});

    await Generation.deleteMany({});
    await send("/new");
    await click("t:essay");
    await send("Raqamli iqtisodiyot");
    await click("l:800");
    await click("tpl:modern");
    expect(buttons(await click("edit"))).toEqual(["ed:topic", "ed:length", "ed:template", "ed:back"]);
    expect(texts(await click("ed:back")).join("\n")).toContain("Tekshirib oling");
  });

  it("cancels a report at any step", async () => {
    await send("/report");
    await send("Raqamli iqtisodiyot");
    expect(texts(await send("/cancel"))[0]).toContain("Bekor qilindi");
    expect(texts(await send("Raqamli iqtisodiyot"))[0]).toContain("/new"); // no longer a topic

    await send("/report");
    await send("Raqamli iqtisodiyot");
    await click("l:5");
    await click("cancel");
    expect((await click("meta:skip")).find((c) => c.method === "answerCallbackQuery")?.payload.text).toContain("eskirgan");
  });

  it("sends the text of a finished report in parts", async () => {
    const user = await User.findOne({ telegramId: 555 });
    const paragraph = "Sun’iy intellekt <ta’limda> & jamiyatda. ".repeat(40);
    const generation = await Generation.create({
      userId: user!._id,
      source: "bot",
      type: "report",
      topic: "AI",
      language: "uz-latn",
      template: "minimal",
      length: 5,
      status: "done",
      content: {
        type: "report",
        title: "Sun’iy intellekt",
        sections: ["Kirish", "1. Asos", "2. Tahlil", "Xulosa"].map((heading, i) => ({ id: `s${i + 1}`, heading, paragraphs: [paragraph, paragraph] })),
        references: ["Muallif A. Kitob. — Toshkent: Fan, 2020."],
      },
    });

    const sent = (await click(`txt:${generation.id}`)).filter((c) => c.method === "sendMessage");
    expect(sent.length).toBeGreaterThan(1);
    expect(sent.every((c) => c.payload.parse_mode === "HTML")).toBe(true);
    expect(String(sent[0]!.payload.text)).toMatch(/^<b>Sun’iy intellekt<\/b>/);
    expect(String(sent[0]!.payload.text)).toContain("&lt;ta’limda&gt; &amp;");
    expect(String(sent.at(-1)!.payload.text)).toContain("Topshirishdan oldin");

    await Generation.updateOne({ _id: generation._id }, { $set: { userId: new mongoose.Types.ObjectId() } });
    expect((await click(`txt:${generation.id}`)).find((c) => c.method === "sendMessage")).toBeUndefined();
  });

  it("converts text between scripts", async () => {
    await send("/convert");
    expect(texts(await send("O‘zbekiston, salom!"))).toEqual(["Ўзбекистон, салом!"]);
    expect(texts(await send("Тошкент шаҳри"))).toEqual(["Toshkent shahri"]);
  });

  it("exports and converts a finished document", async () => {
    const user = await User.findOne({ telegramId: 555 });
    const generation = await Generation.create({
      userId: user!._id,
      source: "bot",
      type: "essay",
      topic: "AI",
      language: "uz-latn",
      template: "modern",
      length: 800,
      status: "done",
      content: { type: "essay", title: "Sun’iy intellekt", sections: [{ id: "s1", heading: "Kirish", paragraphs: ["Matn."] }] },
    });

    const exported = await click(`exp:docx:${generation.id}`);
    const doc = exported.find((c) => c.method === "sendDocument");
    expect(doc?.payload.document).toMatchObject({ filename: "suniy-intellekt_esse.docx" });

    const converted = await click(`cv:${generation.id}`);
    expect(texts(converted).some((t) => t.includes("Сунъий интеллект"))).toBe(true);
    expect(await Generation.countDocuments({ parentId: generation._id, language: "uz-cyrl" })).toBe(1);

    // Someone else's document is not found
    await Generation.updateOne({ _id: generation._id }, { $set: { userId: new mongoose.Types.ObjectId() } });
    const foreign = await click(`exp:pdf:${generation.id}`);
    expect(foreign.find((c) => c.method === "sendDocument")).toBeUndefined();
  });

  it("switches the interface language and the menu", async () => {
    await send("/settings");
    const switched = await click("sui:ru");
    const menu = switched.find((c) => (c.payload.reply_markup as { keyboard?: unknown })?.keyboard);
    expect(JSON.stringify(menu?.payload.reply_markup)).toContain("Новый документ");
    expect(texts(await send("📝 Новый документ"))[0]).toBe("Что подготовим?");
  });

  it("answers stale buttons and free text", async () => {
    expect((await click("unknown:button")).find((c) => c.method === "answerCallbackQuery")).toBeDefined();
    expect(texts(await send("salom"))[0]).toContain("/new");
  });
});
