// Integration test: MongoDB + Redis from docker compose (`npm run db:up`), fake AI and fake Telegram.
import { Worker } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AIError, AIRouter, type AIProvider, type JsonRequest } from "@edugen/shared/ai";
import { connectDb, disconnectDb, ensureIndexes, Generation, mongoose, Usage, User, type UserDocument } from "@edugen/shared/db";
import { consumeQuota, tashkentDate, usedToday } from "@edugen/shared/limits";
import { closeQueues, createRedis, QUEUES, queueOptions, type GenerateJob, type NotifyJob } from "@edugen/shared/queue";
import { AlreadyGeneratingError, QuotaExceededError, startGeneration } from "@edugen/shared/services";
import type { Telegram } from "telegraf";
import { createGenerateProcessor } from "./processors/generate";
import { createNotifyProcessor } from "./processors/notify";

const deck = {
  title: "AI ta'limda",
  subtitle: "Sharh",
  theme: "technology",
  cover_image_query: "",
  slides: [{ title: "Kirish", layout: "bullets", bullets: ["Bir", "Ikki", "Uch"], notes: "Izoh", image_query: "" }],
};

let failAI = false;
const fakeProvider: AIProvider = {
  name: "fake",
  async generateJson<T>(req: JsonRequest<T>) {
    if (failAI) throw new AIError("refusal", "refused"); // permanent → no BullMQ retries, keeps the test fast
    return { data: req.schema.parse(deck), usage: { inputTokens: 1, outputTokens: 1 }, model: "fake-1" };
  },
};

const telegram = {
  editMessageText: vi.fn(async () => true),
  sendMessage: vi.fn(async () => ({ message_id: 99 })),
};

let workers: Worker[] = [];
let user: UserDocument;

async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000) {
  const started = Date.now();
  while (!(await check())) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
}

const input = () => ({
  user,
  source: "bot" as const,
  type: "presentation" as const,
  topic: "Sun'iy intellekt",
  language: "uz-latn" as const,
  template: "dark" as const,
  length: 10,
  botContext: { chatId: 42, progressMessageId: 7 },
});

describe("generation pipeline", () => {
  beforeAll(async () => {
    await connectDb();
    await mongoose.connection.dropDatabase(); // edugen_test only (see vitest.config.ts)
    await ensureIndexes(); // dropDatabase also removes the indexes quotas depend on
    const router = new AIRouter([fakeProvider], { sleep: async () => {} });
    workers = [
      new Worker<GenerateJob>(QUEUES.generate, createGenerateProcessor({ router, telegram: telegram as unknown as Telegram }), {
        ...queueOptions(createRedis()),
      }),
      new Worker<NotifyJob>(QUEUES.notify, createNotifyProcessor(telegram as unknown as Telegram), {
        ...queueOptions(createRedis()),
      }),
    ];
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Generation.deleteMany({}), Usage.deleteMany({})]);
    telegram.editMessageText.mockClear();
    telegram.sendMessage.mockClear();
    failAI = false;
    user = await User.create({ telegramId: 1001, settings: { uiLanguage: "uz-latn" } });
  });

  afterAll(async () => {
    await Promise.all(workers.map((w) => w.close()));
    await closeQueues();
    await disconnectDb();
  });

  it("takes the daily quota atomically", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => consumeQuota(user._id, "generation", 3)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await usedToday(user._id, "generation")).toBe(3);
  });

  it("generates a document and sends it to the chat", async () => {
    const generation = await startGeneration(input());
    // Free plan cannot use the Pro-only Dark template
    expect(generation.template).toBe("modern");
    await expect(startGeneration(input())).rejects.toBeInstanceOf(AlreadyGeneratingError);

    await waitFor(async () => telegram.sendMessage.mock.calls.length > 0);
    const done = await Generation.findById(generation._id).lean();
    expect(done).toMatchObject({ status: "done", progress: 100, ai: { provider: "fake", model: "fake-1" } });
    expect(done?.content?.title).toBe("AI ta’limda");

    const [chatId, text, extra] = telegram.sendMessage.mock.calls[0] as unknown as [number, string, { reply_markup: { inline_keyboard: { callback_data: string }[][] } }];
    expect(chatId).toBe(42);
    expect(text).toContain("AI ta’limda");
    expect(extra.reply_markup.inline_keyboard.flat().map((b) => b.callback_data)).toEqual([
      `exp:pptx:${generation.id}`,
      `exp:pdf:${generation.id}`,
      `cv:${generation.id}`,
      `rg:${generation.id}`,
    ]);
    expect(telegram.editMessageText).toHaveBeenCalledWith(42, 7, undefined, "✅ Tayyor!");
  });

  it("fails, refunds the quota and tells the user", async () => {
    failAI = true;
    const generation = await startGeneration(input());
    expect(await usedToday(user._id, "generation")).toBe(1);

    await waitFor(async () => (await Generation.findById(generation._id).lean())?.status === "failed", 20_000);
    await waitFor(async () => telegram.editMessageText.mock.calls.some((c) => String((c as unknown[])[3]).startsWith("😔")));
    expect(await usedToday(user._id, "generation")).toBe(0);
  });

  it("refuses when the daily limit is used up", async () => {
    await Usage.create({ userId: user._id, date: tashkentDate(), kind: "generation", count: 3 });
    await expect(startGeneration(input())).rejects.toBeInstanceOf(QuotaExceededError);
  });
});
