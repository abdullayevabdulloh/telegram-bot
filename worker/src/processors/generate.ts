import { UnrecoverableError, type Job } from "bullmq";
import { AIError, generateDocument, type AIRouter, type ProgressUpdate } from "@edugen/shared/ai";
import { Generation, User } from "@edugen/shared/db";
import { attachImages } from "@edugen/shared/images";
import { logger } from "@edugen/shared/logger";
import { enqueueNotify, type GenerateJob } from "@edugen/shared/queue";
import { failGeneration } from "@edugen/shared/services";
import { progressText } from "@edugen/shared/telegram";
import type { Telegram } from "telegraf";

const PROGRESS_EDIT_INTERVAL_MS = 3_000; // Telegram limits how often a message may be edited

export function createGenerateProcessor(deps: { router: AIRouter; telegram: Telegram }) {
  return async (job: Job<GenerateJob>): Promise<void> => {
    const { generationId } = job.data;
    const generation = await Generation.findById(generationId);
    // Idempotency: a retried or duplicated job must not write a finished document twice.
    if (!generation || generation.status !== "pending") return;

    const user = await User.findById(generation.userId, { settings: 1 }).lean();
    const ui = user?.settings.uiLanguage ?? "uz-latn";
    const chat = generation.botContext;
    let lastEdit = 0;

    const onProgress = async ({ progress, stage }: ProgressUpdate) => {
      await Generation.updateOne({ _id: generation._id, status: "pending" }, { $set: { progress, stage } });
      await job.updateProgress(progress);
      if (chat?.progressMessageId && Date.now() - lastEdit >= PROGRESS_EDIT_INTERVAL_MS) {
        lastEdit = Date.now();
        await deps.telegram
          .editMessageText(chat.chatId, chat.progressMessageId, undefined, progressText(ui, progress, stage))
          .catch(() => {}); // progress is best effort
      }
    };

    try {
      const result = await generateDocument(
        deps.router,
        { type: generation.type, topic: generation.topic, language: generation.language, length: generation.length },
        onProgress,
      );
      const content = await attachImages(result.content);
      const saved = await Generation.updateOne(
        { _id: generation._id, status: "pending" },
        { $set: { status: "done", progress: 100, content, ai: result.ai }, $unset: { stage: 1, error: 1 } },
      );
      if (saved.modifiedCount) await enqueueNotify({ kind: "done", generationId });
      logger.info({ generationId, type: generation.type, ...result.ai }, "Generation done");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // unavailable = every provider is out of quota or misconfigured: a retry in seconds cannot help
      const permanent =
        error instanceof AIError && (error.kind === "bad_request" || error.kind === "refusal" || error.kind === "unavailable");
      const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      logger.error({ generationId, err: message, attempt: job.attemptsMade + 1, permanent }, "Generation attempt failed");

      if (permanent || lastAttempt) {
        if (await failGeneration(generation._id, message)) await enqueueNotify({ kind: "failed", generationId });
        throw new UnrecoverableError(message);
      }
      throw error; // BullMQ retries with backoff
    }
  };
}
