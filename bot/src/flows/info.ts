import { Generation, User } from "@edugen/shared/db";
import { dailyLimit, effectivePlan, tashkentDate, usedToday } from "@edugen/shared/limits";
import type { BotContext } from "../context";

export async function sendHelp(ctx: BotContext) {
  await ctx.reply(ctx.t("help"), { parse_mode: "HTML" });
}

export async function sendPlan(ctx: BotContext) {
  const plan = effectivePlan(ctx.user);
  const limit = dailyLimit(plan, "generation");
  const used = await usedToday(ctx.user._id, "generation");
  await ctx.reply(
    ctx.t("plan.info", { plan: plan === "pro" ? "Pro" : "Free", left: Math.max(0, limit - used), limit }),
    { parse_mode: "HTML" },
  );
}

/** /stats — only for ADMIN_IDS. */
export async function sendStats(ctx: BotContext) {
  const startOfDay = new Date(`${tashkentDate()}T00:00:00+05:00`);
  const [users, today, byStatus] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startOfDay } }),
    Generation.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
  await ctx.reply(
    [
      `👥 Users: ${users} (+${today} today)`,
      `📄 Today: ${counts.done ?? 0} done, ${counts.pending ?? 0} pending, ${counts.failed ?? 0} failed`,
    ].join("\n"),
  );
}
