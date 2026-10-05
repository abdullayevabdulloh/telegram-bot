import { config, requireEnv } from "@edugen/shared/config";
import { connectDb, disconnectDb } from "@edugen/shared/db";
import { logger } from "@edugen/shared/logger";
import { closeQueues } from "@edugen/shared/queue";
import { createBot, setCommands } from "./bot";

async function main() {
  const bot = createBot(requireEnv("BOT_TOKEN"));
  await connectDb();
  await setCommands(bot);

  const onLaunch = () => logger.info({ username: bot.botInfo?.username, mode: config.BOT_WEBHOOK_DOMAIN ? "webhook" : "polling" }, "Bot started");
  // launch() resolves only when the bot stops, so it is not awaited.
  const launching = config.BOT_WEBHOOK_DOMAIN
    ? bot.launch(
        {
          webhook: {
            domain: config.BOT_WEBHOOK_DOMAIN,
            port: config.BOT_WEBHOOK_PORT,
            path: "/telegram",
            secretToken: requireEnv("BOT_WEBHOOK_SECRET"),
          },
        },
        onLaunch,
      )
    : bot.launch(onLaunch);
  launching.catch((err) => {
    logger.fatal({ err }, "Bot stopped with an error");
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Bot stopping");
    bot.stop(signal);
    await closeQueues();
    await disconnectDb();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "Bot failed to start");
  process.exit(1);
});
