import { detectScript, toScript } from "@edugen/shared/translit";
import type { BotContext } from "../context";

const MESSAGE_LIMIT = 4_000; // Telegram allows 4096 characters

export async function askConvertText(ctx: BotContext) {
  ctx.session = { step: "waiting_convert_text" };
  await ctx.reply(ctx.t("convert.ask"));
}

/** Converts any text to the other script; the user stays in this mode until /cancel or another command. */
export async function handleConvertText(ctx: BotContext, text: string) {
  const script = detectScript(text);
  if (!script) {
    await ctx.reply(ctx.t("convert.noText"));
    return;
  }
  const converted = toScript(text, script === "latin" ? "cyrillic" : "latin");
  if (converted.length <= MESSAGE_LIMIT) {
    await ctx.reply(converted);
  } else {
    await ctx.replyWithDocument(
      { source: Buffer.from(converted, "utf8"), filename: script === "latin" ? "kirill.txt" : "lotin.txt" },
      { caption: ctx.t("convert.asFile") },
    );
  }
}
