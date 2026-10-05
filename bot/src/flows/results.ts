import { exportDocument } from "@edugen/shared/export";
import { logger } from "@edugen/shared/logger";
import { isUzbek, type ExportFormat } from "@edugen/shared/schema";
import { convertGenerationCopy, findOwnedGeneration, recentGenerations } from "@edugen/shared/services";
import { callbacks, doneText, resultKeyboard } from "@edugen/shared/telegram";
import { Markup, type Telegraf } from "telegraf";
import type { BotContext } from "../context";
import { launchGeneration } from "./create";

const TYPE_EMOJI = { essay: "📝", presentation: "📊", work: "📚" } as const;
const ID = "([a-f0-9]{24})";

export async function sendHistory(ctx: BotContext) {
  const items = await recentGenerations(ctx.user._id, 10);
  if (items.length === 0) {
    await ctx.reply(ctx.t("history.empty"));
    return;
  }
  await ctx.reply(
    ctx.t("history.title"),
    Markup.inlineKeyboard(
      items.map((g) => {
        const title = g.content?.title ?? g.topic;
        const label = `${TYPE_EMOJI[g.type]} ${title.length > 45 ? `${title.slice(0, 44)}…` : title}`;
        return [Markup.button.callback(label, callbacks.open(g.id))];
      }),
    ),
  );
}

export function registerResults(bot: Telegraf<BotContext>) {
  bot.action(new RegExp(`^exp:(pdf|docx|pptx):${ID}$`), async (ctx) => {
    const format = ctx.match[1] as ExportFormat;
    const generation = await findOwnedGeneration(ctx.match[2]!, ctx.user._id);
    if (!generation?.content) return ctx.answerCbQuery(ctx.t("notFound"));

    await ctx.answerCbQuery(ctx.t("export.preparing", { format: format.toUpperCase() }));
    await ctx.sendChatAction("upload_document");
    try {
      const file = await exportDocument(format, {
        content: generation.content,
        template: generation.template,
        language: generation.language,
        meta: generation.meta,
      });
      await ctx.replyWithDocument({ source: file.buffer, filename: file.filename });
    } catch (error) {
      logger.error({ err: error, generationId: generation.id, format }, "Export failed");
      await ctx.reply(ctx.t("export.failed"));
    }
  });

  bot.action(new RegExp(`^cv:${ID}$`), async (ctx) => {
    const generation = await findOwnedGeneration(ctx.match[1]!, ctx.user._id);
    if (!generation?.content) return ctx.answerCbQuery(ctx.t("notFound"));
    if (!isUzbek(generation.language)) return ctx.answerCbQuery(ctx.t("convert.notUzbek"), { show_alert: true });

    await ctx.answerCbQuery();
    const copy = await convertGenerationCopy(generation);
    await ctx.reply(doneText(copy, ctx.ui), { parse_mode: "HTML", reply_markup: resultKeyboard(copy, ctx.ui) });
  });

  bot.action(new RegExp(`^op:${ID}$`), async (ctx) => {
    const generation = await findOwnedGeneration(ctx.match[1]!, ctx.user._id);
    if (!generation?.content) return ctx.answerCbQuery(ctx.t("notFound"));
    await ctx.answerCbQuery();
    await ctx.reply(doneText(generation, ctx.ui), { parse_mode: "HTML", reply_markup: resultKeyboard(generation, ctx.ui) });
  });

  bot.action(new RegExp(`^rg:${ID}$`), async (ctx) => {
    const generation = await findOwnedGeneration(ctx.match[1]!, ctx.user._id);
    if (!generation) return ctx.answerCbQuery(ctx.t("notFound"));
    await ctx.answerCbQuery();
    await launchGeneration(ctx, {
      type: generation.type,
      topic: generation.topic,
      language: generation.language,
      template: generation.template,
      length: generation.length,
      meta: generation.meta,
    });
  });
}
