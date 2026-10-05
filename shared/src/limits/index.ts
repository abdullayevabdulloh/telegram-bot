import type { Types } from "mongoose";
import { Usage, type IUser, type PlanId, type UsageKind } from "../db/models";
import { LENGTH_RULES, type DocType, type TemplateId } from "../schema";
import { templates } from "../templates";

export interface Plan {
  generationsPerDay: number;
  aiActionsPerDay: number;
  maxWorkPages: number;
}

// Example numbers — tune them here.
export const PLANS: Record<PlanId, Plan> = {
  free: { generationsPerDay: 3, aiActionsPerDay: 20, maxWorkPages: 10 },
  pro: { generationsPerDay: 50, aiActionsPerDay: 300, maxWorkPages: 25 },
};

export function effectivePlan(user: Pick<IUser, "plan" | "planExpiresAt">, now = new Date()): PlanId {
  if (user.plan === "pro" && (!user.planExpiresAt || user.planExpiresAt > now)) return "pro";
  return "free";
}

export function dailyLimit(plan: PlanId, kind: UsageKind): number {
  return kind === "generation" ? PLANS[plan].generationsPerDay : PLANS[plan].aiActionsPerDay;
}

export function isTemplateAllowed(template: TemplateId, plan: PlanId): boolean {
  return plan === "pro" || !templates[template].proOnly;
}

/** Length presets the plan may choose for this document type. */
export function lengthPresets(type: DocType, plan: PlanId): number[] {
  const rules = LENGTH_RULES[type];
  const max = type === "work" ? PLANS[plan].maxWorkPages : rules.max;
  return rules.presets.filter((n) => n <= max);
}

export function clampLength(type: DocType, plan: PlanId, length: number): number {
  const rules = LENGTH_RULES[type];
  const max = type === "work" ? PLANS[plan].maxWorkPages : rules.max;
  return Math.min(Math.max(Math.round(length), rules.min), max);
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
