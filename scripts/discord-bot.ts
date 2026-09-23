import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { executeCommand, executeCommandBatch, parseCommandBatch, parseDiscordCommand, type LiflowCommand } from "../domain/commands.ts";
import { splitDiscordMessage } from "../domain/discord-interactions.ts";
import { CURRENT_SCHEMA_VERSION } from "../domain/schema.ts";
import type { CoreEntity, EntityType, PlanData } from "../domain/core.ts";

const required = (name: string) => { const value = process.env[name]?.trim(); if (!value) throw new Error(name + " is required in .env.discord"); return value; };
const token = required("DISCORD_BOT_TOKEN"), uid = required("LIFLOW_FIREBASE_UID");
const allowed = new Set(required("DISCORD_ALLOWED_USER_IDS").split(",").map(value => value.trim()).filter(Boolean));
const trusted = new Set((process.env.DISCORD_TRUSTED_CHANNEL_IDS || "").split(",").map(value => value.trim()).filter(Boolean));
const serviceFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim();
if (!getApps().length) initializeApp({ credential: serviceFile ? cert(JSON.parse(readFileSync(serviceFile, "utf8"))) : applicationDefault() });
const db = getFirestore(), entities = db.collection("users").doc(uid).collection("entities");
const commands = [
  new SlashCommandBuilder().setName("n").setDescription("今と次の予定を見る"),
  new SlashCommandBuilder().setName("t").setDescription("タスクを追加").addStringOption(option => option.setName("name").setDescription("内容").setRequired(true)),
  new SlashCommandBuilder().setName("p").setDescription("予定を追加").addStringOption(option => option.setName("name").setDescription("内容").setRequired(true)).addStringOption(option => option.setName("start").setDescription("開始 HH:MM").setRequired(true)).addStringOption(option => option.setName("end").setDescription("終了 HH:MM").setRequired(true)).addStringOption(option => option.setName("date").setDescription("日付 YYYY-MM-DD")),
  new SlashCommandBuilder().setName("a").setDescription("実績を追加").addStringOption(option => option.setName("name").setDescription("内容").setRequired(true)).addStringOption(option => option.setName("start").setDescription("開始 HH:MM").setRequired(true)).addStringOption(option => option.setName("end").setDescription("終了 HH:MM").setRequired(true)).addStringOption(option => option.setName("date").setDescription("日付 YYYY-MM-DD")),
  new SlashCommandBuilder().setName("m").setDescription("収支を追加").addNumberOption(option => option.setName("amount").setDescription("金額").setRequired(true).setMinValue(1)).addStringOption(option => option.setName("name").setDescription("内容").setRequired(true)).addStringOption(option => option.setName("kind").setDescription("種類").addChoices({ name: "支出", value: "expense" }, { name: "収入", value: "income" })).addStringOption(option => option.setName("date").setDescription("日付 YYYY-MM-DD")).addStringOption(option => option.setName("category").setDescription("カテゴリ")).addStringOption(option => option.setName("note").setDescription("メモ")),
  new SlashCommandBuilder().setName("x").setDescription("複数コマンドを実行").addStringOption(option => option.setName("commands").setDescription("改行または ; で区切る").setRequired(true)),
];
const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date = new Date()) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
const iso = (date: string, time: string) => new Date(date + "T" + time + ":00").toISOString();
const rawCreate = async (type: EntityType, payload: Record<string, unknown>) => {
  const ref = entities.doc(), now = new Date().toISOString();
  const entity: CoreEntity = { id: ref.id, type, payload, schemaVersion: CURRENT_SCHEMA_VERSION, revision: 1, createdAt: now, updatedAt: now, updatedBy: "discord:" + uid, deletedAt: null };
  await ref.set(entity); return entity;
};
const create = async (type: EntityType, payload: Record<string, unknown>) => {
  const next = { ...payload };
  if (type === "transaction" && !next.categoryId) {
    const name = String(next.category || "その他").trim() || "その他";
    const snapshot = await entities.where("type", "==", "moneyCategory").get();
    let category = snapshot.docs.map(document => document.data() as CoreEntity).find(item => !item.deletedAt && item.payload.name === name);
    if (!category) category = await rawCreate("moneyCategory", { name, appliesTo: "both", sortOrder: snapshot.size, archived: false, systemKey: null });
    next.category = name; next.categoryId = category.id;
  }
  return rawCreate(type, next);
};
const showNow = async () => {
  const snapshot = await entities.where("type", "==", "plan").get(), now = new Date();
  const plans = snapshot.docs.map(document => document.data() as CoreEntity<PlanData>).filter(item => !item.deletedAt && !item.payload.resolution && new Date(item.payload.endAt) > now).sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt));
  const current = plans.find(plan => new Date(plan.payload.startAt) <= now && now < new Date(plan.payload.endAt)), next = plans.find(plan => new Date(plan.payload.startAt) > now);
  return (current ? "now  " + current.payload.title + " (" + new Date(current.payload.startAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) + ")" : "now  予定なし") + "\n" + (next ? "next " + next.payload.title + " (" + new Date(next.payload.startAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + ")" : "next 予定なし");
};
function structured(interaction: ChatInputCommandInteraction): LiflowCommand | null {
  const name = interaction.commandName;
  if (name === "n") return { type: "SHOW_NOW" };
  if (name === "t") return parseDiscordCommand("t", { title: interaction.options.getString("name", true) });
  if (name === "m") return parseDiscordCommand("m", { title: interaction.options.getString("name", true), amount: interaction.options.getNumber("amount", true), direction: interaction.options.getString("kind") || "expense", date: interaction.options.getString("date") || dateKey(), category: interaction.options.getString("category") || interaction.options.getString("name", true), note: interaction.options.getString("note") || "" });
  if (name === "p" || name === "a") { const date = interaction.options.getString("date") || dateKey(); return parseDiscordCommand(name, { title: interaction.options.getString("name", true), start: iso(date, interaction.options.getString("start", true)), end: iso(date, interaction.options.getString("end", true)) }); }
  return null;
}
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("ready", async ready => {
  const rest = new REST({ version: "10" }).setToken(token), body = commands.map(command => command.toJSON()), guild = process.env.DISCORD_GUILD_ID?.trim();
  if (guild) await rest.put(Routes.applicationGuildCommands(ready.user.id, guild), { body }); else await rest.put(Routes.applicationCommands(ready.user.id), { body });
  console.log("Liflow Discord Bot ready: " + ready.user.tag);
});
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (trusted.size && !trusted.has(interaction.channelId)) { await interaction.reply("このチャンネルからはLiflowを操作できません。"); return; }
  if (interaction.commandName !== "n" && !allowed.has(interaction.user.id)) { await interaction.reply("このDiscordアカウントはLiflowの更新を許可されていません。"); return; }
  await interaction.deferReply();
  try {
    let message = "";
    if (interaction.commandName === "x") {
      const parsed = parseCommandBatch(interaction.options.getString("commands", true));
      if (!parsed) throw new Error("invalid_batch");
      const results = await executeCommandBatch(parsed, { create });
      message = results.length + "件を保存しました。";
    } else {
      const command = structured(interaction);
      if (!command) throw new Error("invalid_command");
      if (command.type === "SHOW_NOW") message = await showNow();
      else { const result = await executeCommand(command, { create }); message = "保存しました：" + String(result.entity?.payload.title || ""); }
    }
    const chunks = splitDiscordMessage(message);
    await interaction.editReply(chunks[0]);
    for (const chunk of chunks.slice(1)) await interaction.followUp(chunk);
  } catch (error) {
    console.error(error);
    await interaction.editReply("Liflowで処理できませんでした。");
  }
});
await client.login(token);
