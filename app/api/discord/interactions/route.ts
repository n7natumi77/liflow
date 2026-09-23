import { NextResponse } from "next/server";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { executeCommand, executeCommandBatch, parseCommandBatch, parseDiscordCommand } from "../../../../domain/commands";
import { allowedDiscordMutation, mutationCommand, optionRecord, splitDiscordMessage, trustedDiscordContext, verifyDiscordSignature, type DiscordInteraction } from "../../../../domain/discord-interactions";
import { CURRENT_SCHEMA_VERSION } from "../../../../domain/schema";
import type { CoreEntity, EntityType, PlanData, TaskData, TransactionData } from "../../../../domain/core";

export const runtime = "nodejs";
const response = (content: string, status = 200) => NextResponse.json({ type: 4, data: { content: splitDiscordMessage(content)[0], allowed_mentions: { parse: [] } } }, { status });
const required = (name: string) => process.env[name]?.trim() || "";
const initialize = () => {
  if (getApps().length) return;
  const raw = required("FIREBASE_SERVICE_ACCOUNT_JSON");
  initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
};
const dateKey = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
const iso = (date: string, time: string) => new Date(date + "T" + time + ":00").toISOString();

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519") || "", timestamp = request.headers.get("x-signature-timestamp") || "", raw = await request.text();
  if (!await verifyDiscordSignature(signature, timestamp, raw, required("DISCORD_PUBLIC_KEY"))) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  const interaction = JSON.parse(raw) as DiscordInteraction;
  if (interaction.type === 1) return NextResponse.json({ type: 1 });
  if (interaction.type !== 2 || !interaction.data?.name) return response("対応していない操作です。", 400);
  const trusted = new Set(required("DISCORD_TRUSTED_CHANNEL_IDS").split(",").map(value => value.trim()).filter(Boolean));
  const allowed = new Set(required("DISCORD_ALLOWED_USER_IDS").split(",").map(value => value.trim()).filter(Boolean));
  if (!trustedDiscordContext(interaction, trusted)) return response("このチャンネルからはLiflowを参照できません。", 403);
  const name = interaction.data.name, options = optionRecord(interaction);
  if (mutationCommand(name) && !allowedDiscordMutation(interaction, allowed)) return response("このDiscordアカウントはLiflowの更新を許可されていません。", 403);
  try {
    initialize();
    const uid = required("LIFLOW_FIREBASE_UID");
    if (!uid) throw new Error("LIFLOW_FIREBASE_UID is required");
    const collection = getFirestore().collection("users").doc(uid).collection("entities");
    const snapshot = await collection.get();
    const entities = snapshot.docs.map(document => document.data() as CoreEntity);
    const rawCreate = async (type: EntityType, payload: Record<string, unknown>) => {
      const ref = collection.doc(), now = new Date().toISOString();
      const entity: CoreEntity = { id: ref.id, type, payload, schemaVersion: CURRENT_SCHEMA_VERSION, revision: 1, createdAt: now, updatedAt: now, updatedBy: "discord:" + (interaction.member?.user?.id || interaction.user?.id || "unknown"), deletedAt: null };
      await ref.set(entity); return entity;
    };
    const create = async (type: EntityType, payload: Record<string, unknown>) => {
      const next = { ...payload };
      if (type === "transaction" && !next.categoryId) {
        const name = String(next.category || "その他").trim() || "その他";
        let category = entities.find(item => item.type === "moneyCategory" && !item.deletedAt && item.payload.name === name);
        if (!category) { category = await rawCreate("moneyCategory", { name, appliesTo: "both", sortOrder: entities.filter(item => item.type === "moneyCategory").length, archived: false, systemKey: null }); entities.push(category); }
        next.category = name; next.categoryId = category.id;
      }
      const saved = await rawCreate(type, next); entities.push(saved); return saved;
    };
    if (name === "schedule" || name === "n" || name === "now") {
      const now = new Date(), range = String(options.range || "today"), end = new Date(now);
      if (range === "6h") end.setHours(end.getHours() + 6); else if (range === "3d") end.setDate(end.getDate() + 3); else end.setHours(23, 59, 59, 999);
      const plans = entities.filter(item => item.type === "plan" && !item.deletedAt).map(item => item as CoreEntity<PlanData>).filter(item => !item.payload.resolution && Date.parse(item.payload.endAt) > now.getTime() && Date.parse(item.payload.startAt) < end.getTime()).sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt));
      return response(plans.length ? plans.map(plan => new Date(plan.payload.startAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " " + plan.payload.title).join("\n") : "この範囲の予定はありません。");
    }
    if (name === "tasks") {
      const tasks = entities.filter(item => item.type === "task" && !item.deletedAt).map(item => item as CoreEntity<TaskData>).filter(item => item.payload.status === "open").slice(0, 30);
      return response(tasks.length ? tasks.map(task => "・" + task.payload.title).join("\n") : "未完了のTaskはありません。");
    }
    if (name === "money") {
      const now = new Date(), mode = String(options.range || "month"), start = new Date(now);
      if (mode === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); else start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const items = entities.filter(item => item.type === "transaction" && !item.deletedAt).map(item => item as CoreEntity<TransactionData>).filter(item => Date.parse(item.payload.occurredAt) >= start.getTime());
      const total = (direction: "income" | "expense") => items.filter(item => item.payload.direction === direction && item.payload.status === "settled").reduce((sum, item) => sum + item.payload.amount, 0);
      return response((mode === "week" ? "今週" : "今月") + "：支出 " + total("expense").toLocaleString("ja-JP") + "円 / 収入 " + total("income").toLocaleString("ja-JP") + "円");
    }
    if (name === "x" || name === "bulk" || name === "liflow") {
      const parsed = parseCommandBatch(String(options.commands || options.command || ""));
      if (!parsed) return response("コマンド形式を読み取れませんでした。", 400);
      const results = await executeCommandBatch(parsed, { create });
      return response(results.length + "件を保存しました。");
    }
    const today = dateKey(new Date());
    const command = parseDiscordCommand(name, {
      title: String(options.title || options.name || ""), amount: Number(options.amount || 0), direction: String(options.direction || options.kind || "expense"),
      category: String(options.category || options.title || options.name || ""), note: String(options.note || ""), date: String(options.date || today),
      start: typeof options.start === "string" ? iso(String(options.date || today), options.start) : "", end: typeof options.end === "string" ? iso(String(options.date || today), options.end) : "",
    });
    if (!command) return response("コマンド形式を読み取れませんでした。", 400);
    const result = await executeCommand(command, { create });
    return response("保存しました：" + String(result.entity?.payload.title || ""));
  } catch (error) {
    console.error("discord_interaction_failed", error);
    return response("Liflowで処理できませんでした。", 500);
  }
}
