import { Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config";
import type { PlanId } from "../db/models";

export const QUEUES = {
  generate: "generate",
  notify: "notify",
} as const;

export interface GenerateJob {
  generationId: string;
}

export interface NotifyJob {
  kind: "done" | "failed";
  generationId: string;
}

/** BullMQ requires maxRetriesPerRequest: null on its connections. */
export function createRedis(): Redis {
  return new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
}

export const asConnection = (redis: Redis) => redis as unknown as ConnectionOptions;

/** Options every Queue and Worker shares (a separate prefix keeps tests away from real jobs). */
export const queueOptions = (redis: Redis) => ({ connection: asConnection(redis), prefix: config.QUEUE_PREFIX });

let queues: { redis: Redis; generate: Queue<GenerateJob>; notify: Queue<NotifyJob> } | undefined;

function getQueues() {
  if (!queues) {
    const redis = createRedis();
    queues = {
      redis,
      generate: new Queue<GenerateJob>(QUEUES.generate, queueOptions(redis)),
      notify: new Queue<NotifyJob>(QUEUES.notify, queueOptions(redis)),
    };
  }
  return queues;
}

export const GENERATE_ATTEMPTS = 3;

export async function enqueueGenerate(generationId: string, plan: PlanId): Promise<void> {
  await getQueues().generate.add(
    "generate",
    { generationId },
    {
      jobId: generationId, // the same generation is never queued twice
      priority: plan === "pro" ? 1 : 10, // lower number = served first
      attempts: GENERATE_ATTEMPTS,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  );
}

export async function enqueueNotify(job: NotifyJob): Promise<void> {
  await getQueues().notify.add(job.kind, job, {
    jobId: `${job.kind}-${job.generationId}`,
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  });
}

export async function closeQueues(): Promise<void> {
  if (!queues) return;
  await Promise.all([queues.generate.close(), queues.notify.close()]);
  queues.redis.disconnect();
  queues = undefined;
}
