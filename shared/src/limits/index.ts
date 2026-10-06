import type { Types } from "mongoose";
import { Usage, type UsageKind } from "../db/models";
import { LENGTH_RULES, type DocType } from "../schema";

// There is no paid plan: every feature is free for everyone. Daily limits only keep AI costs in check — tune them here.
export const LIMITS = { generationsPerDay: 50, aiActionsPerDay: 300 };

export function dailyLimit(kind: UsageKind): number {
  return kind === "generation" ? LIMITS.generationsPerDay : LIMITS.aiActionsPerDay;
}

/** Length presets offered for this document type. */
export function lengthPresets(type: DocType): number[] {
  return [...LENGTH_RULES[type].presets];
}

export function clampLength(type: DocType, length: number): number {
  const rules = LENGTH_RULES[type];
  return Math.min(Math.max(Math.round(length), rules.min), rules.max);
}

/** Calendar day in Tashkent (quotas reset at local midnight). */
export function tashkentDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(date);
}

/**
 * Atomically takes one unit of the daily quota. Returns false when the limit is reached.
 * When the counter is already at the limit the filter matches nothing, the upsert tries to insert
 * a duplicate (userId, date, kind) and Mongo rejects it with E11000.
 */
export async function consumeQuota(
  userId: Types.ObjectId,
  kind: UsageKind,
  limit: number,
  date = tashkentDate(),
): Promise<boolean> {
  try {
    await Usage.findOneAndUpdate(
      { userId, date, kind, count: { $lt: limit } },
      { $inc: { count: 1 } },
      { upsert: true },
    );
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
}

export async function refundQuota(userId: Types.ObjectId, kind: UsageKind, date: string): Promise<void> {
  await Usage.updateOne({ userId, date, kind, count: { $gt: 0 } }, { $inc: { count: -1 } });
}

export async function usedToday(userId: Types.ObjectId, kind: UsageKind): Promise<number> {
  const usage = await Usage.findOne({ userId, date: tashkentDate(), kind }).lean();
  return usage?.count ?? 0;
}
