import mongoose, { type HydratedDocument, type Model, type Types } from "mongoose";
import {
  DOC_TYPES,
  GENERATION_STATUSES,
  LANGUAGES,
  TEMPLATE_IDS,
  UI_LANGUAGES,
  type DocType,
  type DocumentContent,
  type GenerationStatus,
  type Language,
  type TemplateId,
  type TitleMeta,
  type UiLanguage,
} from "../schema";

// mongoose is CommonJS: named value imports fail under native Node ESM.
const { model, models, Schema } = mongoose;

// ------------------------------------------------------------------ User

export interface UserSettings {
  uiLanguage: UiLanguage;
  contentLanguage: Language;
  defaultTemplate: TemplateId;
}

export interface IUser {
  telegramId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;
  settings: UserSettings;
  isBlocked: boolean;
  /** Set once the user picked a language on the first /start. */
  onboardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true },
    username: String,
    firstName: String,
    languageCode: String,
    settings: {
      uiLanguage: { type: String, enum: UI_LANGUAGES, default: "uz-latn" },
      contentLanguage: { type: String, enum: LANGUAGES, default: "uz-latn" },
      defaultTemplate: { type: String, enum: TEMPLATE_IDS, default: "modern" },
    },
    isBlocked: { type: Boolean, default: false },
    onboardedAt: Date,
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<IUser>;
export const User: Model<IUser> = (models.User as Model<IUser>) ?? model<IUser>("User", userSchema);

// ------------------------------------------------------------------ Generation

export interface GenerationStage {
  key: "writing" | "outline" | "chapter" | "section" | "final";
  params?: Record<string, number>;
}

export interface GenerationAiInfo {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  usedFallback: boolean;
}

export interface IGeneration {
  userId: Types.ObjectId;
  /** Set for copies, e.g. a document converted to the other script. */
  parentId?: Types.ObjectId;
  source: "bot" | "web";
  type: DocType;
  topic: string;
  language: Language;
  template: TemplateId;
  /** Words, slides or pages depending on the type (see LENGTH_RULES). */
  length: number;
  meta: TitleMeta;
  content?: DocumentContent;
  revision: number;
  status: GenerationStatus;
  progress: number;
  stage?: GenerationStage;
  error?: string;
  /** Day (Asia/Tashkent) the quota was charged on — needed to refund it. */
  quotaDate?: string;
  botContext?: { chatId: number; progressMessageId?: number };
  ai?: GenerationAiInfo;
  createdAt: Date;
  updatedAt: Date;
}

const generationSchema = new Schema<IGeneration>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Generation" },
    source: { type: String, enum: ["bot", "web"], required: true },
    type: { type: String, enum: DOC_TYPES, required: true },
    topic: { type: String, required: true },
    language: { type: String, enum: LANGUAGES, required: true },
    template: { type: String, enum: TEMPLATE_IDS, required: true },
    length: { type: Number, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
    content: Schema.Types.Mixed,
    revision: { type: Number, default: 0 },
    status: { type: String, enum: GENERATION_STATUSES, default: "pending" },
    progress: { type: Number, default: 0 },
    stage: { key: String, params: Schema.Types.Mixed },
    error: String,
    quotaDate: String,
    botContext: { chatId: Number, progressMessageId: Number },
    ai: {
      provider: String,
      model: String,
      inputTokens: Number,
      outputTokens: Number,
      durationMs: Number,
      usedFallback: Boolean,
    },
  },
  { timestamps: true, minimize: false },
);
generationSchema.index({ userId: 1, createdAt: -1 });
generationSchema.index({ status: 1, createdAt: 1 });

export type GenerationDocument = HydratedDocument<IGeneration>;
export const Generation: Model<IGeneration> =
  (models.Generation as Model<IGeneration>) ?? model<IGeneration>("Generation", generationSchema);

// ------------------------------------------------------------------ Usage (daily quotas)

export type UsageKind = "generation" | "ai_action";

export interface IUsage {
  userId: Types.ObjectId;
  /** YYYY-MM-DD in Asia/Tashkent. */
  date: string;
  kind: UsageKind;
  count: number;
}

const usageSchema = new Schema<IUsage>({
  userId: { type: Schema.Types.ObjectId, required: true },
  date: { type: String, required: true },
  kind: { type: String, enum: ["generation", "ai_action"], required: true },
  count: { type: Number, default: 0 },
});
usageSchema.index({ userId: 1, date: 1, kind: 1 }, { unique: true });

export const Usage: Model<IUsage> = (models.Usage as Model<IUsage>) ?? model<IUsage>("Usage", usageSchema);

// ------------------------------------------------------------------ Bot session

export interface IBotSession {
  key: string;
  data: unknown;
  updatedAt: Date;
}

const botSessionSchema = new Schema<IBotSession>({
  key: { type: String, required: true, unique: true },
  data: Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

export const BotSession: Model<IBotSession> =
  (models.BotSession as Model<IBotSession>) ?? model<IBotSession>("BotSession", botSessionSchema);
