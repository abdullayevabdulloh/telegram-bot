import mongoose from "mongoose";
import { config } from "../config";
import { logger } from "../logger";

export * from "./models";

mongoose.set("strictQuery", true);

export async function connectDb(uri = config.MONGODB_URI): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await ensureIndexes();
  logger.info({ db: mongoose.connection.name }, "MongoDB connected");
}

/**
 * Builds every schema index and waits for it. Mongoose's autoIndex runs in the background and
 * swallows errors, but daily quotas rely on the unique Usage index — without it they are not enforced.
 * createIndexes never drops existing indexes, so it is safe on a live database.
 */
export async function ensureIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export { mongoose };
