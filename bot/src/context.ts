import type { UserDocument } from "@edugen/shared/db";
import type { MessageKey, Params } from "@edugen/shared/i18n";
import type { DocType, Language, TemplateId, TitleMeta, UiLanguage } from "@edugen/shared/schema";
import type { Context } from "telegraf";

export type Step =
  | "idle"
  | "choose_type"
  | "waiting_topic"
  | "choose_length"
  | "waiting_meta"
  | "choose_template"
  | "confirm"
  | "waiting_convert_text";

export interface BotSession {
  step: Step;
  type?: DocType;
  topic?: string;
  /** Empty → the user's default content language. */
  language?: Language;
  length?: number;
  template?: TemplateId;
  meta?: TitleMeta;
}

export interface BotContext extends Context {
  session: BotSession;
  user: UserDocument;
  ui: UiLanguage;
  t: (key: MessageKey, params?: Params) => string;
}
