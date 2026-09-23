import type {
  ActualData,
  CoreEntity,
  EntityType,
  PlanData,
  TaskData,
  TransactionData,
} from "./core.ts";

export type LiflowCommand =
  | { type: "CREATE_TASK"; title: string; deadline?: string | null }
  | {
      type: "CREATE_PLAN";
      title: string;
      startAt: string;
      endAt: string;
      taskId?: string | null;
    }
  | {
      type: "CREATE_ACTUAL";
      title: string;
      startAt: string;
      endAt: string;
      planId?: string | null;
    }
  | {
      type: "CREATE_TRANSACTION";
      title: string;
      amount: number;
      direction: "income" | "expense";
      occurredAt: string;
      category?: string;
      note?: string;
    }
  | { type: "SHOW_NOW" };
export type CommandResult = {
  kind: "created" | "navigate";
  entity?: CoreEntity;
  destination?: "now";
};
export type CommandPort = {
  create: (
    type: EntityType,
    payload: Record<string, unknown>,
  ) => Promise<CoreEntity>;
  createMany?: (
    inputs: { type: EntityType; payload: Record<string, unknown> }[],
  ) => Promise<CoreEntity[]>;
};

const validRange = (start: string, end: string) =>
  Number.isFinite(Date.parse(start)) &&
  Number.isFinite(Date.parse(end)) &&
  Date.parse(start) < Date.parse(end);
export function validateCommand(command: LiflowCommand) {
  if (command.type === "SHOW_NOW") return;
  if (!command.title.trim()) throw new Error("command_title_required");
  if (
    (command.type === "CREATE_PLAN" || command.type === "CREATE_ACTUAL") &&
    !validRange(command.startAt, command.endAt)
  )
    throw new Error("command_time_invalid");
  if (
    command.type === "CREATE_TRANSACTION" &&
    (!Number.isFinite(command.amount) || command.amount <= 0)
  )
    throw new Error("command_amount_invalid");
}
export async function executeCommand(
  command: LiflowCommand,
  port: CommandPort,
): Promise<CommandResult> {
  validateCommand(command);
  if (command.type === "SHOW_NOW")
    return { kind: "navigate", destination: "now" };
  if (command.type === "CREATE_TASK") {
    const payload: TaskData = {
      title: command.title.trim(),
      description: "",
      deadline: command.deadline || null,
      estimateMinutes: null,
      estimatedRemainingMinutes: null,
      nextAction: null,
      directionId: null,
      projectId: null,
      parentTaskId: null,
      calendarCategoryId: null,
      status: "open",
      completedAt: null,
    };
    return { kind: "created", entity: await port.create("task", payload) };
  }
  if (command.type === "CREATE_PLAN") {
    const payload: PlanData = {
      title: command.title.trim(),
      taskId: command.taskId || null,
      projectId: null,
      calendarCategoryId: null,
      directionId: null,
      startAt: command.startAt,
      endAt: command.endAt,
      type: "personal",
      flexibility: "fixed",
      allDay: false,
      resolution: null,
      rescheduledFromPlanId: null,
      rescheduledToPlanId: null,
    };
    return { kind: "created", entity: await port.create("plan", payload) };
  }
  if (command.type === "CREATE_ACTUAL") {
    const payload: ActualData = {
      title: command.title.trim(),
      taskId: null,
      planId: command.planId || null,
      projectId: null,
      calendarCategoryId: null,
      directionId: null,
      startAt: command.startAt,
      endAt: command.endAt,
      type: "personal",
      note: "",
    };
    return { kind: "created", entity: await port.create("actual", payload) };
  }
  const payload: TransactionData = {
    title: command.title.trim(),
    amount: Math.abs(command.amount),
    direction: command.direction,
    category: command.category?.trim() || "その他",
    occurredAt: command.occurredAt,
    status: "settled",
    projectId: null,
    actualId: null,
    planId: null,
    taskId: null,
    note: command.note?.trim() || "",
  };
  return { kind: "created", entity: await port.create("transaction", payload) };
}

export function parseCommandBatch(input: string, now = new Date()) {
  const normalized = input.replace(
    /\s+(?=\/(?:n|now|t|task|p|plan|a|actual|m|money|mi|income)\s)/gi,
    "\n",
  );
  const lines = normalized
    .split(/[;\n]+/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !/^```(?:text)?$/i.test(line));
  if (!lines.length) return null;
  const commands = lines.map((line) => parseCommand(line, now));
  return commands.every((command): command is LiflowCommand => command !== null)
    ? commands
    : null;
}

export async function executeCommandBatch(
  commands: LiflowCommand[],
  port: CommandPort,
): Promise<CommandResult[]> {
  if (!commands.length) throw new Error("command_batch_empty");
  commands.forEach(validateCommand);
  if (commands.some((command) => command.type === "SHOW_NOW")) {
    if (commands.length !== 1) throw new Error("command_navigation_mixed");
    return [await executeCommand(commands[0], port)];
  }
  if (!port.createMany)
    return Promise.all(commands.map((command) => executeCommand(command, port)));
  const inputs = commands.map((command) =>
    commandInput(command as Exclude<LiflowCommand, { type: "SHOW_NOW" }>),
  );
  const entities = await port.createMany(inputs);
  return entities.map((entity) => ({ kind: "created", entity }));
}

export function commandInput(command: Exclude<LiflowCommand, { type: "SHOW_NOW" }>) {
  validateCommand(command);
  if (command.type === "CREATE_TASK")
    return {
      type: "task" as const,
      payload: {
        title: command.title.trim(), description: "", deadline: command.deadline || null,
        estimateMinutes: null, estimatedRemainingMinutes: null, nextAction: null,
        directionId: null, projectId: null, parentTaskId: null,
        calendarCategoryId: null, status: "open", completedAt: null,
      } satisfies TaskData,
    };
  if (command.type === "CREATE_PLAN")
    return {
      type: "plan" as const,
      payload: {
        title: command.title.trim(), taskId: command.taskId || null, projectId: null,
        calendarCategoryId: null, directionId: null, startAt: command.startAt, endAt: command.endAt,
        type: "personal", flexibility: "fixed", allDay: false, resolution: null,
        rescheduledFromPlanId: null, rescheduledToPlanId: null,
      } satisfies PlanData,
    };
  if (command.type === "CREATE_ACTUAL")
    return {
      type: "actual" as const,
      payload: {
        title: command.title.trim(), taskId: null, planId: command.planId || null,
        projectId: null, calendarCategoryId: null, directionId: null, startAt: command.startAt,
        endAt: command.endAt, type: "personal", note: "",
      } satisfies ActualData,
    };
  return {
    type: "transaction" as const,
    payload: {
      title: command.title.trim(), amount: Math.abs(command.amount), direction: command.direction,
      category: command.category?.trim() || "その他", occurredAt: command.occurredAt, status: "settled",
      projectId: null, actualId: null, planId: null, taskId: null,
      note: command.note?.trim() || "",
    } satisfies TransactionData,
  };
}

const localIso = (date: string, time: string) => {
  const value = new Date(`${date}T${time}:00`);
  return Number.isFinite(value.getTime()) ? value.toISOString() : "";
};
const moneyText = (raw: string) => {
  const match = raw.trim().match(/^(.*?)\s+--note\s+(.+)$/i);
  return { title: (match?.[1] || raw).trim(), note: match?.[2]?.trim() || "" };
};
export function parseCommand(
  input: string,
  now = new Date(),
): LiflowCommand | null {
  const text = input.trim().replace(/^\/+\s*/, "");
  if (!text) return null;
  if (/^(n|now|今|今日あと何)$/i.test(text)) return { type: "SHOW_NOW" };
  const task = text.match(/^(?:t|task|タスク)\s+(.+)$/i);
  if (task) return { type: "CREATE_TASK", title: task[1] };
  const datedMoney = text.match(
    /^(m|money|お金|支出|mi|income|収入)\s+(\d{4}-\d{2}-\d{2})\s+([0-9,]+)\s+(.+)$/i,
  );
  if (datedMoney) {
    const occurredAt = localIso(datedMoney[2], "12:00");
    const details = moneyText(datedMoney[4]);
    return {
      type: "CREATE_TRANSACTION",
      amount: Number(datedMoney[3].replaceAll(",", "")),
      direction: /^(mi|income|収入)$/i.test(datedMoney[1])
        ? "income"
        : "expense",
      title: details.title,
      category: details.title,
      note: details.note,
      occurredAt,
    };
  }
  const money = text.match(/^(?:m|money|お金|支出)\s+([0-9,]+)\s+(.+)$/i);
  if (money) {
    const details = moneyText(money[2]);
    return {
      type: "CREATE_TRANSACTION",
      amount: Number(money[1].replaceAll(",", "")),
      direction: "expense",
      title: details.title,
      category: details.title,
      note: details.note,
      occurredAt: now.toISOString(),
    };
  }
  const income = text.match(/^(?:mi|income|収入)\s+([0-9,]+)\s+(.+)$/i);
  if (income) {
    const details = moneyText(income[2]);
    return {
      type: "CREATE_TRANSACTION",
      amount: Number(income[1].replaceAll(",", "")),
      direction: "income",
      title: details.title,
      category: details.title,
      note: details.note,
      occurredAt: now.toISOString(),
    };
  }
  const timed = text.match(
    /^(p|plan|予定|a|actual|実績)\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+(.+)$/i,
  );
  if (timed) {
    const startAt = localIso(timed[2], timed[3]),
      endAt = localIso(timed[2], timed[4]);
    return /^(a|actual|実績)$/i.test(timed[1])
      ? { type: "CREATE_ACTUAL", title: timed[5], startAt, endAt }
      : { type: "CREATE_PLAN", title: timed[5], startAt, endAt };
  }
  return null;
}
export function parseDiscordCommand(
  name: string,
  options: Record<string, string | number>,
  now = new Date(),
): LiflowCommand | null {
  if (name === "now") return { type: "SHOW_NOW" };
  if ((name === "t" || name === "task") && typeof options.title === "string")
    return { type: "CREATE_TASK", title: options.title };
  if (
    (name === "m" || name === "money") &&
    typeof options.title === "string" &&
    typeof options.amount === "number"
  )
    return {
      type: "CREATE_TRANSACTION",
      title: options.title,
      amount: options.amount,
      direction: options.direction === "income" ? "income" : "expense",
      category:
        typeof options.category === "string" ? options.category : options.title,
      note: typeof options.note === "string" ? options.note : "",
      occurredAt:
        typeof options.date === "string"
          ? localIso(options.date, "12:00")
          : now.toISOString(),
    };
  if (
    (name === "p" || name === "plan" || name === "a" || name === "actual") &&
    typeof options.title === "string" &&
    typeof options.start === "string" &&
    typeof options.end === "string"
  )
    return name === "p" || name === "plan"
      ? {
          type: "CREATE_PLAN",
          title: options.title,
          startAt: options.start,
          endAt: options.end,
        }
      : {
          type: "CREATE_ACTUAL",
          title: options.title,
          startAt: options.start,
          endAt: options.end,
        };
  return null;
}
