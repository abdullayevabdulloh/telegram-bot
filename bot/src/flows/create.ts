import { LANGUAGE_NAMES, type MessageKey } from "@edugen/shared/i18n";
import { lengthPresets } from "@edugen/shared/limits";
import { escapeHtml } from "@edugen/shared/telegram";
import {
  DOC_TYPES,
  hasTitlePage,
  LANGUAGES,
  LENGTH_RULES,
  TEMPLATE_IDS,
  TOPIC_MAX,
  TOPIC_MIN,
  TopicSchema,
  parseTitleMeta,
  type DocType,
  type Language,
  type TemplateId,
  type TitleMeta,
} from "@edugen/shared/schema";
import { AlreadyGeneratingError, QuotaExceededError, startGeneration, type StartGenerationInput } from "@edugen/shared/services";
import { templates } from "@edugen/shared/templates";
import { Markup, type Telegraf } from "telegraf";
import type { BotContext, Step } from "../context";
import { cancelButton, dropButtons, editOrReply, rows, TYPE_KEYS } from "../ui";

const unitText = (ctx: BotContext, type: DocType, n: number) => ctx.t(`unit.${LENGTH_RULES[type].unit}`, { n });

/** Steps that wait for a button; free text there gets a hint instead of being lost. */
const BUTTON_STEPS: Step[] = ["choose_type", "choose_length", "choose_template", "confirm"];

const META_FIELDS = ["university", "faculty", "subject", "student", "group", "teacher", "city", "year"] as const satisfies (keyof TitleMeta)[];

export async function askType(ctx: BotContext) {
  ctx.session = { step: "choose_type" };
  await ctx.reply(
    ctx.t("new.chooseType"),
    Markup.inlineKeyboard([
      ...(Object.keys(TYPE_KEYS) as DocType[]).map((type) => [Markup.button.callback(ctx.t(TYPE_KEYS[type]), `t:${type}`)]),
      [cancelButton(ctx)],
    ]),
  );
}

async function askTopic(ctx: BotContext) {
  ctx.session.step = "waiting_topic";
  await ctx.reply(ctx.t("new.askTopic", { type: ctx.t(TYPE_KEYS[ctx.session.type!]) }), {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([cancelButton(ctx)]),
  });
}

/** Main-menu shortcut: a report without the type step. */
export async function askReportTopic(ctx: BotContext) {
  ctx.session = { step: "waiting_topic", type: "report" };
  await askTopic(ctx);
}

async function askLength(ctx: BotContext) {
  const type = ctx.session.type!;
  ctx.session.step = "choose_length";
  const presets = lengthPresets(type);
  await ctx.reply(
    ctx.t(`new.chooseLength.${LENGTH_RULES[type].unit}`),
    Markup.inlineKeyboard([
      ...rows(presets.map((n) => Markup.button.callback(unitText(ctx, type, n), `l:${n}`)), 3),
      [cancelButton(ctx)],
    ]),
  );
}

async function askMeta(ctx: BotContext) {
  ctx.session.step = "waiting_meta";
  await ctx.reply(ctx.t("new.askMeta"), {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([[Markup.button.callback(ctx.t("btn.skip"), "meta:skip")], [cancelButton(ctx)]]),
  });
}

async function askTemplate(ctx: BotContext) {
  ctx.session.step = "choose_template";
  const buttons = TEMPLATE_IDS.map((id) => {
    const mark = id === ctx.user.settings.defaultTemplate ? " ✓" : "";
    return Markup.button.callback(`🎨 ${templates[id].name}${mark}`, `tpl:${id}`);
  });
  await ctx.reply(ctx.t("new.chooseTemplate"), Markup.inlineKeyboard([...rows(buttons, 3), [cancelButton(ctx)]]));
}

/** Filled title-page fields, one per line; empty when nothing was given. */
function metaText(ctx: BotContext, meta: TitleMeta | undefined): string {
  const lines = META_FIELDS.filter((field) => meta?.[field] !== undefined).map(
    (field) => `• ${ctx.t(`meta.${field}` as MessageKey)}: ${escapeHtml(String(meta![field]))}`,
  );
  return lines.length ? ctx.t("new.confirmMeta", { fields: lines.join("\n") }) : "";
}

async function showConfirm(ctx: BotContext) {
  const s = ctx.session;
  ctx.session.step = "confirm";
  ctx.session.editing = undefined;
  const language = s.language ?? ctx.user.settings.contentLanguage;
  const text = ctx.t("new.confirm", {
    type: ctx.t(TYPE_KEYS[s.type!]),
    topic: escapeHtml(s.topic!),
    language: LANGUAGE_NAMES[language],
    length: unitText(ctx, s.type!, s.length!),
    template: templates[s.template!].name,
    meta: hasTitlePage(s.type!) ? metaText(ctx, s.meta) : "",
  });
  await editOrReply(ctx, text, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback(ctx.t("new.create"), "go")],
      [Markup.button.callback(ctx.t("new.edit"), "edit"), Markup.button.callback(ctx.t("new.changeLanguage"), "chl")],
      [cancelButton(ctx)],
    ]),
  });
}

/** Sends the progress message and queues the generation; the worker reports back into that message. */
export async function launchGeneration(ctx: BotContext, input: Omit<StartGenerationInput, "user" | "source" | "botContext">) {
  const progress = await ctx.reply(ctx.t("gen.queued"));
  try {
    await startGeneration({
      ...input,
      user: ctx.user,
      source: "bot",
      botContext: { chatId: ctx.chat!.id, progressMessageId: progress.message_id },
    });
    ctx.session = { step: "idle" };
  } catch (error) {
    const text =
      error instanceof QuotaExceededError
        ? ctx.t("gen.limitExceeded", { limit: error.limit })
        : error instanceof AlreadyGeneratingError
          ? ctx.t("gen.alreadyRunning")
          : null;
    if (!text) throw error;
    await ctx.telegram.editMessageText(ctx.chat!.id, progress.message_id, undefined, text);
  }
}

export function registerCreate(bot: Telegraf<BotContext>) {
  bot.action(new RegExp(`^t:(${DOC_TYPES.join("|")})$`), async (ctx) => {
    const type = ctx.match[1] as DocType;
    ctx.session = { step: "waiting_topic", type };
    await ctx.answerCbQuery();
    await editOrReply(ctx, `${ctx.t("new.chooseType")} ${ctx.t(TYPE_KEYS[type])}`);
    await askTopic(ctx);
  });

  bot.action(/^l:(\d+)$/, async (ctx) => {
    const { type, step } = ctx.session;
    const length = Number(ctx.match[1]);
    if (!type || step !== "choose_length" || !lengthPresets(type).includes(length)) {
      await ctx.answerCbQuery(ctx.t("new.expired"));
      return;
    }
    ctx.session.length = length;
    await ctx.answerCbQuery();
    await editOrReply(ctx, `📏 ${unitText(ctx, type, length)}`);
    if (ctx.session.editing) await showConfirm(ctx);
    else if (hasTitlePage(type)) await askMeta(ctx);
    else await askTemplate(ctx);
  });

  bot.action("meta:skip", async (ctx) => {
    if (ctx.session.step !== "waiting_meta") return ctx.answerCbQuery(ctx.t("new.expired"));
    await ctx.answerCbQuery();
    await dropButtons(ctx);
    if (ctx.session.editing) {
      ctx.session.meta = undefined;
      await showConfirm(ctx);
    } else {
      await askTemplate(ctx);
    }
  });

  bot.action(new RegExp(`^tpl:(${TEMPLATE_IDS.join("|")})$`), async (ctx) => {
    const template = ctx.match[1] as TemplateId;
    if (!ctx.session.type || !ctx.session.topic || !ctx.session.length) return ctx.answerCbQuery(ctx.t("new.expired"));
    ctx.session.template = template;
    await ctx.answerCbQuery();
    await showConfirm(ctx);
  });

  bot.action("chl", async (ctx) => {
    if (ctx.session.step !== "confirm") return ctx.answerCbQuery(ctx.t("new.expired"));
    await ctx.answerCbQuery();
    await editOrReply(
      ctx,
      ctx.t("new.chooseLanguage"),
      Markup.inlineKeyboard(rows(LANGUAGES.map((lang) => Markup.button.callback(LANGUAGE_NAMES[lang], `cl:${lang}`)), 2)),
    );
  });

  bot.action(/^cl:(uz-latn|uz-cyrl|ru|en)$/, async (ctx) => {
    if (ctx.session.step !== "confirm") return ctx.answerCbQuery(ctx.t("new.expired"));
    ctx.session.language = ctx.match[1] as Language;
    await ctx.answerCbQuery();
    await showConfirm(ctx);
  });

  bot.action("edit", async (ctx) => {
    const { step, type } = ctx.session;
    if (step !== "confirm" || !type) return ctx.answerCbQuery(ctx.t("new.expired"));
    await ctx.answerCbQuery();
    const fields: ("topic" | "length" | "meta" | "template")[] = ["topic", "length", ...(hasTitlePage(type) ? (["meta"] as const) : []), "template"];
    await editOrReply(
      ctx,
      ctx.t("edit.choose"),
      Markup.inlineKeyboard([
        ...rows(fields.map((field) => Markup.button.callback(ctx.t(`edit.${field}`), `ed:${field}`)), 2),
        [Markup.button.callback(ctx.t("btn.back"), "ed:back")],
      ]),
    );
  });

  bot.action(/^ed:(topic|length|meta|template|back)$/, async (ctx) => {
    const field = ctx.match[1]!;
    const { step, type, topic, length, template } = ctx.session;
    if (step !== "confirm" || !type || !topic || !length || !template) return ctx.answerCbQuery(ctx.t("new.expired"));
    if (field === "meta" && !hasTitlePage(type)) return ctx.answerCbQuery(ctx.t("new.expired"));
    await ctx.answerCbQuery();
    if (field === "back") return showConfirm(ctx);

    ctx.session.editing = true;
    await dropButtons(ctx);
    if (field === "topic") await askTopic(ctx);
    else if (field === "length") await askLength(ctx);
    else if (field === "meta") await askMeta(ctx);
    else await askTemplate(ctx);
  });

  bot.action("go", async (ctx) => {
    const { step, type, topic, length, template, meta, language } = ctx.session;
    if (step !== "confirm" || !type || !topic || !length || !template) return ctx.answerCbQuery(ctx.t("new.expired"));
    await ctx.answerCbQuery();
    await dropButtons(ctx);
    await launchGeneration(ctx, {
      type,
      topic,
      length,
      template,
      meta,
      language: language ?? ctx.user.settings.contentLanguage,
    });
  });

  bot.action("cancel", async (ctx) => {
    ctx.session = { step: "idle" };
    await ctx.answerCbQuery();
    await editOrReply(ctx, ctx.t("cancelled"));
  });
}

/** Text input for the steps of the creation flow. Returns false when the step is not ours. */
export async function handleCreateText(ctx: BotContext, text: string): Promise<boolean> {
  const { step } = ctx.session;
  if (step === "waiting_topic") {
    const topic = TopicSchema.safeParse(text);
    if (!topic.success) {
      await ctx.reply(ctx.t("new.topicInvalid", { min: TOPIC_MIN, max: TOPIC_MAX }));
      return true;
    }
    ctx.session.topic = topic.data;
    if (ctx.session.editing) {
      await showConfirm(ctx);
      return true;
    }
    ctx.session.template = ctx.user.settings.defaultTemplate;
    await askLength(ctx);
    return true;
  }
  if (step === "waiting_meta") {
    const meta = parseTitleMeta(text);
    if (Object.keys(meta).length === 0) {
      await ctx.reply(ctx.t("new.metaEmpty"));
      return true;
    }
    ctx.session.meta = meta;
    if (ctx.session.editing) await showConfirm(ctx);
    else await askTemplate(ctx);
    return true;
  }
  if (BUTTON_STEPS.includes(step)) {
    await ctx.reply(ctx.t("new.useButtons"));
    return true;
  }
  return false;
}
