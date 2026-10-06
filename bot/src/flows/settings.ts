import { LANGUAGE_NAMES } from "@edugen/shared/i18n";
import { LANGUAGES, TEMPLATE_IDS, UI_LANGUAGES, type Language, type TemplateId, type UiLanguage } from "@edugen/shared/schema";
import { templates } from "@edugen/shared/templates";
import { Markup, type Telegraf } from "telegraf";
import type { BotContext } from "../context";
import { editOrReply, mainMenu, rows } from "../ui";

export async function sendSettings(ctx: BotContext) {
  const { settings } = ctx.user;
  await editOrReply(
    ctx,
    ctx.t("settings.title", {
      ui: LANGUAGE_NAMES[settings.uiLanguage],
      content: LANGUAGE_NAMES[settings.contentLanguage],
      template: templates[settings.defaultTemplate].name,
    }),
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback(ctx.t("settings.ui"), "set:ui")],
        [Markup.button.callback(ctx.t("settings.content"), "set:cl")],
        [Markup.button.callback(ctx.t("settings.template"), "set:tpl")],
      ]),
    },
  );
}

const back = (ctx: BotContext) => [Markup.button.callback(ctx.t("btn.back"), "set:home")];
const mark = (selected: boolean) => (selected ? "✓ " : "");

export function registerSettings(bot: Telegraf<BotContext>) {
  bot.action("set:home", async (ctx) => {
    await ctx.answerCbQuery();
    await sendSettings(ctx);
  });

  bot.action("set:ui", async (ctx) => {
    await ctx.answerCbQuery();
    const current = ctx.user.settings.uiLanguage;
    await editOrReply(
      ctx,
      ctx.t("settings.chooseUi"),
      Markup.inlineKeyboard([
        ...UI_LANGUAGES.map((lang) => [Markup.button.callback(mark(lang === current) + LANGUAGE_NAMES[lang], `sui:${lang}`)]),
        back(ctx),
      ]),
    );
  });

  bot.action("set:cl", async (ctx) => {
    await ctx.answerCbQuery();
    const current = ctx.user.settings.contentLanguage;
    await editOrReply(
      ctx,
      ctx.t("settings.chooseContent"),
      Markup.inlineKeyboard([
        ...rows(LANGUAGES.map((lang) => Markup.button.callback(mark(lang === current) + LANGUAGE_NAMES[lang], `scl:${lang}`)), 2),
        back(ctx),
      ]),
    );
  });

  bot.action("set:tpl", async (ctx) => {
    await ctx.answerCbQuery();
    const current = ctx.user.settings.defaultTemplate;
    await editOrReply(
      ctx,
      ctx.t("settings.chooseTemplate"),
      Markup.inlineKeyboard([
        ...rows(TEMPLATE_IDS.map((id) => Markup.button.callback(`${mark(id === current)}${templates[id].name}`, `stp:${id}`)), 3),
        back(ctx),
      ]),
    );
  });

  bot.action(/^sui:(uz-latn|uz-cyrl|ru)$/, async (ctx) => {
    const lang = ctx.match[1] as UiLanguage;
    ctx.user.settings.uiLanguage = lang;
    await ctx.user.save();
    ctx.ui = lang;
    await ctx.answerCbQuery(ctx.t("settings.saved"));
    await sendSettings(ctx);
    // The reply keyboard is text-based, so it has to be re-sent in the new language.
    await ctx.reply(ctx.t("settings.saved"), mainMenu(lang));
  });

  bot.action(/^scl:(uz-latn|uz-cyrl|ru|en)$/, async (ctx) => {
    ctx.user.settings.contentLanguage = ctx.match[1] as Language;
    await ctx.user.save();
    await ctx.answerCbQuery(ctx.t("settings.saved"));
    await sendSettings(ctx);
  });

  bot.action(new RegExp(`^stp:(${TEMPLATE_IDS.join("|")})$`), async (ctx) => {
    const template = ctx.match[1] as TemplateId;
    ctx.user.settings.defaultTemplate = template;
    await ctx.user.save();
    await ctx.answerCbQuery(ctx.t("settings.saved"));
    await sendSettings(ctx);
  });
}
