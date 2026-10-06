import mongoose, { type Types } from "mongoose";
import { Generation, type GenerationDocument, type IGeneration, type UserDocument } from "../db/models";
import { logger } from "../logger";
import { clampLength, consumeQuota, dailyLimit, refundQuota, tashkentDate } from "../limits";
import { enqueueGenerate, enqueueNotify } from "../queue";
import { TopicSchema, type DocType, type Language, type TemplateId, type TitleMeta } from "../schema";
import { latinToCyrillic, cyrillicToLatin, mapStrings } from "../translit";

export class QuotaExceededError extends Error {
  constructor(readonly limit: number) {
    super(`Daily limit of ${limit} reached`);
  }
}

export class AlreadyGeneratingError extends Error {
  constructor() {
    super("A generation is already in progress");
  }
}

/** A generation still "pending" after this long is considered dead. */
export const STALE_PENDING_MS = 30 * 60_000;

export interface StartGenerationInput {
  user: UserDocument;
  source: IGeneration["source"];
  type: DocType;
  topic: string;
  language: Language;
  template: TemplateId;
  length: number;
  meta?: TitleMeta;
  botContext?: IGeneration["botContext"];
}

/** Checks limits, stores a pending generation and queues it for the worker. */
export async function startGeneration(input: StartGenerationInput): Promise<GenerationDocument> {
  const userId = input.user._id;

  const running = await Generation.exists({
    userId,
    status: "pending",
    createdAt: { $gt: new Date(Date.now() - STALE_PENDING_MS) },
  });
  if (running) throw new AlreadyGeneratingError();

  const limit = dailyLimit("generation");
  const quotaDate = tashkentDate();
  if (!(await consumeQuota(userId, "generation", limit, quotaDate))) throw new QuotaExceededError(limit);

  const generation = await Generation.create({
    userId,
    source: input.source,
    type: input.type,
    topic: TopicSchema.parse(input.topic),
    language: input.language,
    template: input.template,
    length: clampLength(input.type, input.length),
    meta: input.meta ?? {},
    quotaDate,
    botContext: input.botContext,
  });

  try {
    await enqueueGenerate(generation.id);
  } catch (error) {
    await failGeneration(generation._id, "Could not queue the job");
    throw error;
  }
  return generation;
}

/**
 * Marks a pending generation as failed and gives the quota back.
 * Idempotent: returns null when the generation is no longer pending.
 */
export async function failGeneration(id: Types.ObjectId | string, error: string): Promise<GenerationDocument | null> {
  const generation = await Generation.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "failed", error: error.slice(0, 500) } },
    { returnDocument: "after" },
  );
  if (generation?.quotaDate) await refundQuota(generation.userId, "generation", generation.quotaDate);
  return generation;
}

/** Fails generations that stayed pending too long (e.g. the job was lost). */
export async function failStaleGenerations(): Promise<number> {
  const stale = await Generation.find(
    { status: "pending", createdAt: { $lt: new Date(Date.now() - STALE_PENDING_MS) } },
    { _id: 1 },
  ).lean();
  for (const { _id } of stale) {
    if (await failGeneration(_id, "Timed out")) {
      await enqueueNotify({ kind: "failed", generationId: String(_id) }).catch((err) =>
        logger.warn({ err, generationId: String(_id) }, "Could not queue failure notification"),
      );
    }
  }
  return stale.length;
}

export async function findOwnedGeneration(id: string, userId: Types.ObjectId): Promise<GenerationDocument | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  return Generation.findOne({ _id: id, userId });
}

export async function recentGenerations(userId: Types.ObjectId, limit = 10): Promise<GenerationDocument[]> {
  return Generation.find({ userId, status: "done" }).sort({ createdAt: -1 }).limit(limit);
}

/** Copies a finished Uzbek document into the other script (no AI, no quota). */
export async function convertGenerationCopy(source: GenerationDocument): Promise<GenerationDocument> {
  if (!source.content || (source.language !== "uz-latn" && source.language !== "uz-cyrl")) {
    throw new Error("Only finished Uzbek documents can be converted");
  }
  const toCyrillic = source.language === "uz-latn";
  const convert = toCyrillic ? latinToCyrillic : cyrillicToLatin;
  return Generation.create({
    userId: source.userId,
    parentId: source._id,
    source: source.source,
    type: source.type,
    topic: convert(source.topic),
    language: toCyrillic ? "uz-cyrl" : "uz-latn",
    template: source.template,
    length: source.length,
    meta: mapStrings(source.meta ?? {}, convert),
    content: mapStrings(source.content, convert),
    status: "done",
    progress: 100,
  });
}
