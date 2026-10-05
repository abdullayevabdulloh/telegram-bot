import { pino } from "pino";
import { config } from "./config";

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: ["token", "*.token", "headers.authorization"],
  ...(config.NODE_ENV === "development" && {
    transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
  }),
});

export type Logger = typeof logger;
