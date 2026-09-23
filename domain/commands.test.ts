import test from "node:test";
import assert from "node:assert/strict";
import {
  executeCommand,
  executeCommandBatch,
  commandInput,
  parseCommand,
  parseCommandBatch,
  parseDiscordCommand,
  validateCommand,
} from "./commands.ts";
import { CURRENT_SCHEMA_VERSION } from "./schema.ts";
test("deterministic text becomes a structured task command", () =>
  assert.deepEqual(parseCommand("タスク 物理レポート"), {
    type: "CREATE_TASK",
    title: "物理レポート",
  }));
test("short aliases avoid Japanese command names", () => {
  assert.deepEqual(parseCommand("t report"), {
    type: "CREATE_TASK",
    title: "report",
  });
  assert.equal(parseCommand("n")?.type, "SHOW_NOW");
  assert.equal(parseCommand("m 420 train")?.type, "CREATE_TRANSACTION");
});
test("money command parses amount without writing data", () =>
  assert.deepEqual(
    parseCommand("支出 420 電車", new Date("2026-09-15T12:00:00Z")),
    {
      type: "CREATE_TRANSACTION",
      amount: 420,
      direction: "expense",
      title: "電車",
      category: "電車",
      note: "",
      occurredAt: "2026-09-15T12:00:00.000Z",
    },
  ));
test("dated money command preserves migration date and category", () =>
  assert.deepEqual(parseCommand("m 2026-05-01 850 ご飯"), {
    type: "CREATE_TRANSACTION",
    amount: 850,
    direction: "expense",
    title: "ご飯",
    category: "ご飯",
    note: "",
    occurredAt: new Date("2026-05-01T12:00:00").toISOString(),
  }));
test("money command accepts a memo after --note", () =>
  assert.deepEqual(parseCommand("m 2026-05-01 16000 歯医者 --note 抜歯代、矯正の診察代"), {
    type: "CREATE_TRANSACTION",
    amount: 16000,
    direction: "expense",
    title: "歯医者",
    category: "歯医者",
    note: "抜歯代、矯正の診察代",
    occurredAt: new Date("2026-05-01T12:00:00").toISOString(),
  }));
test("dated money command accepts an explicit category", () => {
  assert.deepEqual(parseCommand("/m 2026-09-20 220 越中宮崎→泊 --category 交通費"), {
    type: "CREATE_TRANSACTION", amount: 220, direction: "expense", title: "越中宮崎→泊",
    category: "交通費", note: "", occurredAt: new Date("2026-09-20T12:00:00").toISOString(),
  });
  assert.deepEqual(parseCommand("/m 2026-09-18 159 Suica物販 --category その他　"), {
    type: "CREATE_TRANSACTION", amount: 159, direction: "expense", title: "Suica物販",
    category: "その他", note: "", occurredAt: new Date("2026-09-18T12:00:00").toISOString(),
  });
});
test("invalid time is rejected before persistence", () =>
  assert.throws(
    () =>
      validateCommand({
        type: "CREATE_PLAN",
        title: "予定",
        startAt: "2026-09-15T19:00:00Z",
        endAt: "2026-09-15T18:00:00Z",
      }),
    /command_time_invalid/,
  ));
test("web and external clients share one executor", async () => {
  const calls: unknown[] = [];
  await executeCommand(
    { type: "CREATE_TASK", title: "確認" },
    {
      create: async (type, payload) => {
        calls.push({ type, payload });
        return {
          id: "1",
          type,
          payload,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          revision: 1,
          createdAt: "",
          updatedAt: "",
          updatedBy: "test",
          deletedAt: null,
        };
      },
    },
  );
  assert.equal((calls[0] as { type: string }).type, "task");
});
test("Discord input becomes the same structured command", () =>
  assert.deepEqual(parseDiscordCommand("task", { title: "提出する" }), {
    type: "CREATE_TASK",
    title: "提出する",
  }));
test("multiple lines and semicolons form one validated batch", () => {
  const commands = parseCommandBatch("t A\nm 420 train; t B");
  assert.equal(commands?.length, 3);
  assert.equal(commands?.[1].type, "CREATE_TRANSACTION");
});
test("Discord-style slashes and copied code fences are accepted", () => {
  const commands = parseCommandBatch("```text\n/mi 2026-05-01 20000 cash\n/m 2026-05-01 850 food\n```");
  assert.equal(commands?.length, 2);
  assert.equal(commands?.[0].type, "CREATE_TRANSACTION");
});
test("Discord-collapsed whitespace still separates slash commands", () => {
  const commands = parseCommandBatch(
    "/mi 2026-05-01 20000 親からもらった現金 /m 2026-05-01 16000 歯医者 --note 抜歯代、矯正の診察代 /m 2026-05-01 250 交通費",
  );
  assert.equal(commands?.length, 3);
  assert.equal(commands?.[0].type, "CREATE_TRANSACTION");
  assert.equal(
    commands?.[1].type === "CREATE_TRANSACTION" ? commands[1].note : null,
    "抜歯代、矯正の診察代",
  );
});
test("batch parsing has no Liflow item count limit", () => {
  const commands = parseCommandBatch(
    Array.from({ length: 25 }, (_, index) => `t item-${index}`).join("\n"),
  );
  assert.equal(commands?.length, 25);
});
test("batch uses one atomic adapter call when available", async () => {
  let count = 0;
  const commands = parseCommandBatch("t A; t B")!;
  const results = await executeCommandBatch(commands, {
    create: async () => { throw new Error("not used"); },
    createMany: async (inputs) => {
      count++;
      return inputs.map((input, index) => ({
        id: String(index), ...input, schemaVersion: CURRENT_SCHEMA_VERSION, revision: 1,
        createdAt: "", updatedAt: "", updatedBy: "test", deletedAt: null,
      }));
    },
  });
  assert.equal(count, 1);
  assert.equal(results.length, 2);
});
test("v4 command payloads keep Project optional and initialize vNext fields", () => {
  const task = commandInput({ type: "CREATE_TASK", title: "確認" });
  const plan = commandInput({ type: "CREATE_PLAN", title: "散歩", startAt: "2026-01-01T10:00:00Z", endAt: "2026-01-01T11:00:00Z" });
  const actual = commandInput({ type: "CREATE_ACTUAL", title: "写真整理", startAt: "2026-01-01T12:00:00Z", endAt: "2026-01-01T12:20:00Z" });
  assert.equal(task.payload.directionId, null);
  assert.equal(task.payload.nextAction, null);
  assert.equal(task.payload.estimatedRemainingMinutes, null);
  assert.equal(plan.payload.taskId, null);
  assert.equal(plan.payload.projectId, null);
  assert.equal(plan.payload.directionId, null);
  assert.equal(actual.payload.planId, null);
  assert.equal(actual.payload.directionId, null);
});
