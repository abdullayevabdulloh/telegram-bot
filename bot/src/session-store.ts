import { BotSession as SessionModel } from "@edugen/shared/db";
import type { AsyncSessionStore } from "telegraf/session";
import type { BotSession } from "./context";

/** Sessions live in MongoDB so a restart or a second bot instance keeps the conversation state. */
export const mongoSessionStore: AsyncSessionStore<BotSession> = {
  async get(key) {
    const doc = await SessionModel.findOne({ key }).lean();
    return (doc?.data as BotSession | undefined) ?? undefined;
  },
  async set(key, data) {
    await SessionModel.updateOne({ key }, { $set: { data, updatedAt: new Date() } }, { upsert: true });
  },
  async delete(key) {
    await SessionModel.deleteOne({ key });
  },
};
