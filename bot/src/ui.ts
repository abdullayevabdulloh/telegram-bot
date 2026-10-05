import { t, type MessageKey } from "@edugen/shared/i18n";
import type { DocType, UiLanguage } from "@edugen/shared/schema";
import { Markup, TelegramError } from "telegraf";
import type { BotContext } from "./context";

export const TYPE_KEYS: Record<DocType, MessageKey> = {
  essay: "type.essay",
  presentation: "type.presentation",
  work: "type.work",
};

export function mainMenu(lang: UiLanguage) {
  return Markup.keyboard([
    [t(lang, "menu.new")],
    [t(lang, "menu.history"), t(lang, "menu.convert")],
    [t(lang, "menu.settings"), t(lang, "menu.plan"), t(lang, "menu.help")],
  ]).resize();
}

export const cancelButton = (ctx: BotContext) => Markup.button.callback(ctx.t("btn.cancel"), "cancel");

/** Splits buttons into rows of `size`. */
export function rows<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/** Edits the message behind a callback button, ignoring "message is not modified". */
export async function editOrReply(ctx: BotContext, text: string, extra: Parameters<BotContext["reply"]>[1] = {}) {
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, extra as Parameters<BotContext["editMessageText"]>[1]);
      return;
    } catch (error) {
      if (error instanceof TelegramError && error.description.includes("message is not modified")) return;
    }
  }
  await ctx.reply(text, extra);
}

/** Removes inline buttons from the message that was clicked (protects against double clicks). */
export async function dropButtons(ctx: BotContext) {
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});
}
