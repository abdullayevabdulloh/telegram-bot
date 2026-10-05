import { LANGUAGE_NAMES } from "@edugen/shared/i18n";
import { UI_LANGUAGES, type UiLanguage } from "@edugen/shared/schema";
import { Markup, type Telegraf } from "telegraf";
import type { BotContext } from "../context";
import { dropButtons, mainMenu } from "../ui";

// Shown before we know the user's language, so it is written in all three.
const CHOOSE_LANGUAGE = "🌐 Tilni tanlang\n🌐 Тилни танланг\n🌐 Выберите язык";

export async function sendWelcome(ctx: BotContext) {
  ctx.session = { step: "idle" };
  await ctx.reply(ctx.t("welcome", { name: escapeName(ctx.from?.first_name ?? "") }), {
    parse_mode: "HTML",
    ...mainMenu(ctx.ui),
  });
}

const escapeName = (name: string) => name.replace(/[<>&]/g, "");

export function registerStart(bot: Telegraf<BotContext>) {
  bot.start(async (ctx) => {
    if (!ctx.user.onboardedAt) {
      await ctx.reply(
        CHOOSE_LANGUAGE,
        Markup.inlineKeyboard(UI_LANGUAGES.map((lang) => [Markup.button.callback(LANGUAGE_NAMES[lang], `onb:${lang}`)])),
      );
      return;
    }
    await sendWelcome(ctx);
  });

  bot.action(/^onb:(uz-latn|uz-cyrl|ru)$/, async (ctx) => {
    const lang = ctx.match[1] as UiLanguage;
    ctx.user.settings.uiLanguage = lang;
    ctx.user.settings.contentLanguage = lang; // documents in the same language by default
    ctx.user.onboardedAt ??= new Date();
    await ctx.user.save();
    ctx.ui = lang;
    await ctx.answerCbQuery(LANGUAGE_NAMES[lang]);
    await dropButtons(ctx);
    await sendWelcome(ctx);
  });
}
