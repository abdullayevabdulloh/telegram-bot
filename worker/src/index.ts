import { Worker } from "bullmq";
import { createAIRouter } from "@edugen/shared/ai";
import { config, requireEnv } from "@edugen/shared/config";
import { connectDb, disconnectDb } from "@edugen/shared/db";
import { logger } from "@edugen/shared/logger";
import { closeQueues, createRedis, enqueueNotify, QUEUES, queueOptions, type GenerateJob, type NotifyJob } from "@edugen/shared/queue";
import { failGeneration, failStaleGenerations } from "@edugen/shared/services";
import { Telegram } from "telegraf";
import { createGenerateProcessor } from "./processors/generate";
import { createNotifyProcessor } from "./processors/notify";

const CLEANUP_INTERVAL_MS = 5 * 60_000;

async function main() {
  await connectDb();
  const router = createAIRouter();
  const telegram = new Telegram(requireEnv("BOT_TOKEN"));

  const generateWorker = new Worker<GenerateJob>(QUEUES.generate, createGenerateProcessor({ router, telegram }), {
    ...queueOptions(createRedis()),
    concurrency: config.WORKER_CONCURRENCY,
  });
  const notifyWorker = new Worker<NotifyJob>(QUEUES.notify, createNotifyProcessor(telegram), {
    ...queueOptions(createRedis()),
    concurrency: 5,
    limiter: { max: 25, duration: 1_000 }, // stay under Telegram's ~30 messages/second
  });

  // Covers jobs that never reached the processor's own handling (e.g. stalled too many times).
  generateWorker.on("failed", async (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    try {
      if (await failGeneration(job.data.generationId, error.message)) {
        await enqueueNotify({ kind: "failed", generationId: job.data.generationId });
      }
    } catch (err) {
      logger.error({ err, generationId: job.data.generationId }, "Could not mark generation as failed");
    }
  });
  notifyWorker.on("failed", (job, error) => logger.warn({ jobId: job?.id, err: error.message }, "Notification failed"));
  for (const worker of [generateWorker, notifyWorker]) worker.on("error", (err) => logger.error({ err }, "Worker error"));

  const cleanup = async () => {
    const count = await failStaleGenerations().catch((err) => logger.error({ err }, "Cleanup failed"));
    if (count) logger.warn({ count }, "Stale generations marked as failed");
  };
  await cleanup();
  const timer = setInterval(cleanup, CLEANUP_INTERVAL_MS);

  logger.info({ concurrency: config.WORKER_CONCURRENCY, ai: router.providerNames }, "Worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Worker stopping — waiting for running jobs");
    clearInterval(timer);
    await Promise.all([generateWorker.close(), notifyWorker.close()]);
    await closeQueues();
    await disconnectDb();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "Worker failed to start");
  process.exit(1);
});
