import type { Job } from "bullmq";
import { Generation, User } from "@edugen/shared/db";
import { t } from "@edugen/shared/i18n";
import { logger } from "@edugen/shared/logger";
import type { NotifyJob } from "@edugen/shared/queue";
import { doneText, resultKeyboard, retryKeyboard } from "@edugen/shared/telegram";
import { TelegramError, type Telegram } from "telegraf";

/** Sends the final result (or failure) of a bot generation to the user's chat. */
export function createNotifyProcessor(telegram: Telegram) {
  return async (job: Job<NotifyJob>): Promise<void> => {
    const generation = await Generation.findById(job.data.generationId);
    if (!generation?.botContext) return; // web generations are not announced in Telegram

    const user = await User.findById(generation.userId);
    if (!user || user.isBlocked) return;
    const ui = user.settings.uiLanguage;
    const { chatId, progressMessageId } = generation.botContext;

    try {
      if (job.data.kind === "done" && generation.content) {
        if (progressMessageId) {
          await telegram.editMessageText(chatId, progressMessageId, undefined, t(ui, "gen.ready")).catch(() => {});
        }
        // A new message (not an edit) so the user gets a notification.
        await telegram.sendMessage(chatId, doneText(generation, ui), {
          parse_mode: "HTML",
          reply_markup: resultKeyboard(generation, ui),
        });
      } else {
        const text = t(ui, "gen.failed");
        const extra = { reply_markup: retryKeyboard(generation.id, ui) };
        const edited = progressMessageId
          ? await telegram.editMessageText(chatId, progressMessageId, undefined, text, extra).then(() => true, () => false)
          : false;
        if (!edited) await telegram.sendMessage(chatId, text, extra);
      }
    } catch (error) {
      if (error instanceof TelegramError && error.code === 403) {
        // The user blocked the bot — nothing to retry.
        await User.updateOne({ _id: user._id }, { $set: { isBlocked: true } });
        logger.info({ telegramId: user.telegramId }, "User blocked the bot");
        return;
      }
      throw error;
    }
  };
}
