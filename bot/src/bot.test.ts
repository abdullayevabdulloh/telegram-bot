// Drives the bot with fake Telegram updates; API calls are captured instead of sent.
// Needs MongoDB and Redis from docker compose (`npm run db:up`).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BotSession, connectDb, disconnectDb, ensureIndexes, Generation, mongoose, User } from "@edugen/shared/db";
import { closeQueues } from "@edugen/shared/queue";
import { Telegram } from "telegraf";
import type { Update } from "telegraf/types";
import { createBot } from "./bot";

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
    expect(buttons(templates)).toEqual(["tpl:modern", "tpl:minimal", "tpl:dark", "cancel"]);

    expect((await click("tpl:dark")).find((c) => c.method === "answerCallbackQuery")?.payload).toMatchObject({ show_alert: true });

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
    expect(buttons(lengths)).toEqual(["l:6", "l:8", "l:10", "cancel"]); // Free plan: ≤ 10 pages
    await click("l:8");
    await send("OTM: TDIU\nTalaba: Aliyev Vali\nGuruh: IQ-21");
    await click("tpl:minimal");
    await click("go");
    const generation = await Generation.findOne().lean();
    expect(generation?.meta).toEqual({ university: "TDIU", student: "Aliyev Vali", group: "IQ-21" });
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
