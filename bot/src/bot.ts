import { config } from "@edugen/shared/config";
import { User } from "@edugen/shared/db";
import { allTranslations, t, uiLanguageFromTelegram, type MessageKey } from "@edugen/shared/i18n";
import { logger } from "@edugen/shared/logger";
import type { UiLanguage } from "@edugen/shared/schema";
import { session, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import type { BotContext } from "./context";
import { askConvertText, handleConvertText } from "./flows/convert";
import { askReportTopic, askType, handleCreateText, registerCreate } from "./flows/create";
import { sendHelp, sendPlan, sendStats } from "./flows/info";
import { registerResults, sendHistory } from "./flows/results";
import { registerSettings, sendSettings } from "./flows/settings";
import { registerStart } from "./flows/start";
import { mongoSessionStore } from "./session-store";
import { mainMenu } from "./ui";

export function createBot(token: string): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(token, { handlerTimeout: 60_000 });
  // Private chats only; load (or create) the user and the translator.
  bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.from.is_bot || (ctx.chat && ctx.chat.type !== "private")) return;
    const defaultUi = uiLanguageFromTelegram(ctx.from.language_code);
    const user = await User.findOneAndUpdate(
      { telegramId: ctx.from.id },
      {
        $set: {
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          languageCode: ctx.from.language_code,
          isBlocked: false,
        },
        $setOnInsert: { "settings.uiLanguage": defaultUi, "settings.contentLanguage": defaultUi },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (!user) return;
    ctx.user = user;
    ctx.ui = user.settings.uiLanguage;
    ctx.t = (key, params) => t(ctx.ui, key, params);
    return next();
  });

  bot.use(session({ store: mongoSessionStore, defaultSession: () => ({ step: "idle" as const }) }));

  registerStart(bot);

  // Commands and menu buttons always interrupt the current step.
  const actions: [command: string, menuKey: MessageKey, handler: (ctx: BotContext) => Promise<unknown>][] = [
    ["new", "menu.new", askType],
    ["report", "menu.report", askReportTopic],
    ["history", "menu.history", sendHistory],
    ["convert", "menu.convert", askConvertText],
    ["settings", "menu.settings", sendSettings],
    ["plan", "menu.plan", sendPlan],
    ["help", "menu.help", sendHelp],
  ];
  for (const [command, menuKey, handler] of actions) {
    const run = async (ctx: BotContext) => {
      if (command !== "convert" && command !== "new") ctx.session = { step: "idle" };
      await handler(ctx);
    };
    bot.command(command, run);
    bot.hears(allTranslations(menuKey), run);
  }

  bot.command("cancel", async (ctx) => {
    ctx.session = { step: "idle" };
    await ctx.reply(ctx.t("cancelled"), mainMenu(ctx.ui));
  });

  bot.command("stats", async (ctx) => {
    if (config.ADMIN_IDS.includes(ctx.from.id)) await sendStats(ctx);
  });

  registerCreate(bot);
  registerResults(bot);
  registerSettings(bot);

  bot.on(message("text"), async (ctx) => {
    const text = ctx.message.text;
    if (ctx.session.step === "waiting_convert_text") return handleConvertText(ctx, text);
    if (await handleCreateText(ctx, text)) return;
    await ctx.reply(ctx.t("idleHint"), mainMenu(ctx.ui));
  });

  // Unknown or outdated buttons (e.g. after a deploy) must not spin forever.
  bot.on("callback_query", (ctx) => ctx.answerCbQuery(ctx.t("new.expired")));

  bot.catch(async (error, ctx) => {
    logger.error({ err: error, update: ctx.updateType, userId: ctx.from?.id }, "Bot handler failed");
    await ctx.reply(ctx.t ? ctx.t("error") : "Error").catch(() => {});
  });

  return bot;
}

/** Command list shown in the Telegram menu, per client language. */
export async function setCommands(bot: Telegraf<BotContext>) {
  const commands = (lang: UiLanguage) =>
    (["start", "new", "report", "history", "convert", "settings", "plan", "help", "cancel"] as const).map((command) => ({
      command,
      description: t(lang, `cmd.${command}`),
    }));
  await bot.telegram.setMyCommands(commands("uz-latn"));
  await bot.telegram.setMyCommands(commands("uz-latn"), { language_code: "uz" });
  await bot.telegram.setMyCommands(commands("ru"), { language_code: "ru" });
}
