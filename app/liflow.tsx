"use client";
import { useEffect, useRef, useState } from "react";
import {
  Home,
  CalendarDays,
  CalendarRange,
  ListTodo,
  Inbox,
  Plus,
  X,
  ArrowRight,
  Trash2,
  FolderTree,
  Repeat2,
  WalletCards,
  Settings,
  Search,
} from "lucide-react";
import {
  active,
  inheritedCategory,
  unresolved,
  validTimeRange,
  wouldCreateCycle,
  type ActualData,
  type ConflictData,
  type CoreEntity,
  type TaskData,
  type PlanData,
  type InboxData,
  type CalendarCategoryData,
  type ProjectData,
  type SettingsData,
  type DirectionData,
  type ExecutionSessionData,
  type RoutineFlowData,
  type RoutineRunData,
  type SleepRecordData,
  type EntityType,
} from "../domain/core";
import CalendarView from "./calendar-view";
import { TasksView } from "./tasks-view";
import { InboxView } from "./inbox-view";
import NowView from "./now-view";
import { DiaryThemeProvider } from "./diary-theme";
import { DiaryNavigation } from "./diary-navigation";
import { DiaryDialog } from "./diary-dialog";
import { dayRange, scheduledPlans } from "./diary-time";
import type { Capture, CaptureState as Modal } from "./diary-types";
import { MoneyView, ProjectsView, RoutinesView } from "./life-sections";
import {
  createEntity,
  createEntities,
  completeExecutionSession,
  deleteActualAndUnlinkPlan,
  listBackups,
  postponePlan,
  prepareUserData,
  recordActualForPlan,
  recordPlanAsActual,
  recordWakeAndStartMorningFlow,
  resolveConflict,
  restoreBackup,
  savePlannedWake,
  startExecutionSession,
  subscribeEntities,
  syncFutureBlocks,
  syncNotificationJobs,
  syncRecurringPlans,
  updateEntity,
  type BackupSummary,
  type SyncState,
} from "./firebase-store";
import { executeCommandBatch, parseCommandBatch } from "../domain/commands";
import { sendToDiscord } from "./discord-client";
import { createExecutionSessionPayload, advanceRoutineRun } from "../domain/execution";
import { buildNotificationJobs } from "../domain/notifications";
import { disablePushNotifications, enablePushNotifications, notificationCapability, refreshPushSubscription, registerPwaServiceWorker } from "./notifications-client";

const nav = [
  ["now", "今", Home],
  ["today", "今日", CalendarDays],
  ["plan", "カレンダー", CalendarRange],
  ["tasks", "タスク", ListTodo],
  ["projects", "プロジェクト", FolderTree],
  ["routines", "ルーティン", Repeat2],
  ["money", "お金", WalletCards],
  ["inbox", "未整理", Inbox],
  ["settings", "設定", Settings],
] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d = new Date()) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toIso = (date: string, time: string) =>
  new Date(`${date}T${time}:00`).toISOString();
const displayTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

function LiflowApp({
  userName,
  userId,
  onSignOut,
}: {
  userName: string;
  userId: string;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState("now");
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("接続中");
  const [modal, setModal] = useState<Modal>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [notificationEntry] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("notification") || "");
  const automationSignature = useRef("");
  const notificationsEnabled = active<SettingsData>(entities, "settings")[0]?.payload.notificationsEnabled;
  useEffect(() => {
    let stop = () => {},
      cancelled = false;
    void prepareUserData(userId)
      .then(() => {
        if (!cancelled)
          stop = subscribeEntities(
            userId,
            (next) => {
              setEntities(next);
              setLoaded(true);
            },
            setSyncState,
            (message) => {
              setError(message);
              setLoaded(true);
            },
          );
      })
      .catch((reason) => {
        console.error(reason);
        if (!cancelled) {
          setSyncState("同期エラー");
          setError(
            "データ更新前のバックアップまたは移行に失敗したため、自動更新を停止しました。Firestoreのルールと通信を確認してください。",
          );
          setLoaded(true);
        }
      });
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => {
      cancelled = true;
      stop();
      clearInterval(t);
    };
  }, [userId]);
  useEffect(() => {
    void registerPwaServiceWorker().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const signature = entities.map(item => `${item.id}:${item.revision}:${item.deletedAt || ""}`).sort().join("|");
    if (automationSignature.current === signature) return;
    automationSignature.current = signature;
    let cancelled = false;
    const merge = (base: CoreEntity[], saved: CoreEntity[]) => [
      ...base.filter(item => !saved.some(next => next.id === item.id)),
      ...saved,
    ];
    void (async () => {
      try {
        let next = entities;
        const recurring = await syncRecurringPlans(userId, next, new Date());
        next = merge(next, recurring);
        const future = await syncFutureBlocks(userId, next, new Date());
        next = merge(next, future.saved);
        await syncNotificationJobs(userId, buildNotificationJobs(userId, next, new Date()));
        if (!cancelled && (recurring.length || future.saved.length)) setEntities(next);
      } catch (reason) {
        console.error("phase2_automation_failed", reason);
      }
    })();
    return () => { cancelled = true; };
  }, [entities, loaded, userId]);
  useEffect(() => {
    if (notificationsEnabled) void refreshPushSubscription(userId).catch(() => undefined);
  }, [notificationsEnabled, userId]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!document.querySelector("dialog[open]")) setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const create = async (type: EntityType, payload: Record<string, unknown>) => {
    try {
      const saved = await createEntity(userId, type, payload);
      setEntities((v) =>
        v.some((e) => e.id === saved.id) ? v : [...v, saved],
      );
      setError("");
    } catch {
      setError("保存できませんでした。通信を確認してください。");
      throw Error();
    }
  };
  const commandCreate = async (
    type: EntityType,
    payload: Record<string, unknown>,
  ) => {
    const saved = await createEntity(userId, type, payload);
    setEntities((v) => (v.some((e) => e.id === saved.id) ? v : [...v, saved]));
    return saved;
  };
  const commandCreateMany = async (
    inputs: { type: EntityType; payload: Record<string, unknown> }[],
  ) => {
    const saved = await createEntities(userId, inputs);
    setEntities((value) => [
      ...value,
      ...saved.filter((item) => !value.some((old) => old.id === item.id)),
    ]);
    return saved;
  };
  const update = async (
    entity: CoreEntity,
    payload: Record<string, unknown>,
    deleted = false,
  ) => {
    const optimistic = {
      ...entity,
      payload,
      revision: entity.revision + 1,
      deletedAt: deleted ? new Date().toISOString() : entity.deletedAt,
    };
    setEntities((v) => v.map((e) => (e.id === entity.id ? optimistic : e)));
    try {
      const saved = await updateEntity(userId, entity, payload, deleted);
      setEntities((v) => v.map((e) => (e.id === entity.id ? saved : e)));
      setError("");
    } catch (e) {
      setEntities((v) =>
        v.map((item) => (item.id === entity.id ? entity : item)),
      );
      setError(
        e instanceof Error && e.message === "revision_conflict"
          ? "別の端末で同じ項目が更新されました。最新状態を確認して、もう一度保存してください。"
          : navigator.onLine
            ? "保存できませんでした。通信を確認してください。"
            : "オフライン中は変更を保存できません。接続後にもう一度操作してください。",
      );
      throw e;
    }
  };
  const postpone = async (plan: CoreEntity<PlanData>) => {
    try {
      const result = await postponePlan(userId, plan);
      setEntities((v) => [
        ...v.filter((e) => e.id !== plan.id && e.id !== result.nextPlan.id),
        result.resolved,
        result.nextPlan,
      ]);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error &&
          (e.message === "revision_conflict" ||
            e.message === "already_reconciled")
          ? "この予定は別の端末ですでに変更されています。最新状態を確認してください。"
          : navigator.onLine
            ? "延期を保存できませんでした。通信を確認してください。"
            : "オフライン中は延期できません。接続後にもう一度操作してください。",
      );
      throw e;
    }
  };
  const recordAsPlanned = async (plan: CoreEntity<PlanData>) => {
    try {
      const result = await recordPlanAsActual(userId, plan);
      setEntities((v) => [
        ...v.filter((e) => e.id !== plan.id && e.id !== result.actual.id),
        result.linkedPlan,
        result.actual,
      ]);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error &&
          (e.message === "revision_conflict" ||
            e.message === "already_reconciled")
          ? "この予定は別の端末ですでに整理されています。最新状態を確認してください。"
          : navigator.onLine
            ? "実績を保存できませんでした。通信を確認してください。"
            : "オフライン中は実績を保存できません。接続後にもう一度操作してください。",
      );
      throw e;
    }
  };
  const createLinkedActual = async (
    plan: CoreEntity<PlanData>,
    payload: ActualData,
  ) => {
    try {
      const result = await recordActualForPlan(userId, plan, payload);
      setEntities((v) => [
        ...v.filter((e) => e.id !== plan.id && e.id !== result.actual.id),
        result.linkedPlan,
        result.actual,
      ]);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error &&
          (e.message === "revision_conflict" ||
            e.message === "already_reconciled")
          ? "この予定は別の端末ですでに整理されています。最新状態を確認してください。"
          : navigator.onLine
            ? "実績を保存できませんでした。通信を確認してください。"
            : "オフライン中は実績を保存できません。接続後にもう一度操作してください。",
      );
      throw e;
    }
  };
  const remove = async (entity: CoreEntity) => {
    if (entity.type === "actual") {
      const actual = entity as CoreEntity<ActualData>,
        linkedPlan = plans.find((p) => p.id === actual.payload.planId);
      if (linkedPlan) {
        try {
          const result = await deleteActualAndUnlinkPlan(
            userId,
            actual,
            linkedPlan,
          );
          setEntities((v) => [
            ...v.filter((e) => e.id !== actual.id && e.id !== linkedPlan.id),
            result.deletedActual,
            result.unlinkedPlan,
          ]);
          setError("");
          return;
        } catch (e) {
          setError(
            e instanceof Error && e.message === "revision_conflict"
              ? "別の端末で予定または実績が更新されました。最新状態を確認してください。"
              : "削除できませんでした。通信を確認してください。",
          );
          throw e;
        }
      }
    }
    await update(entity, entity.payload, true);
  };
  const beginExecution = async (targetId: string, suggestedMinutes: number | null) => {
    if (active<ExecutionSessionData>(entities, "executionSession").some(item => item.payload.status === "running")) return;
    const target = entities.find(item => item.id === targetId);
    if (!target || (target.type !== "task" && target.type !== "plan")) return;
    const planTarget = target.type === "plan" ? target as CoreEntity<PlanData> : null;
    const linkedTask = tasks.find(item => item.id === (target.type === "task" ? target.id : planTarget?.payload.taskId));
    const saved = await startExecutionSession(userId, createExecutionSessionPayload(target as CoreEntity<TaskData> | CoreEntity<PlanData>, new Date(), suggestedMinutes, linkedTask));
    setEntities(value => [...value.filter(item => item.id !== saved.id), saved]);
  };
  const endExecution = async (sessionId: string, completeTask = false) => {
    const session = entities.find(item => item.id === sessionId && item.type === "executionSession") as CoreEntity<ExecutionSessionData> | undefined;
    if (!session) return;
    const result = await completeExecutionSession(userId, session, new Date().toISOString(), completeTask);
    setEntities(value => [
      ...value.filter(item => ![result.session.id, result.actual.id, result.task?.id].filter(Boolean).includes(item.id)),
      result.session,
      result.actual,
      ...(result.task ? [result.task] : []),
    ]);
  };
  const recordWake = async () => {
    const now = new Date(), date = localDate(now);
    const sleep = active<SleepRecordData>(entities, "sleepRecord").find(item => item.payload.date === date);
    const flow = active<RoutineFlowData>(entities, "routineFlow").find(item => item.payload.active && item.payload.trigger.type === "afterWake");
    const running = active<RoutineRunData>(entities, "routineRun").find(item => item.payload.status === "running");
    const result = await recordWakeAndStartMorningFlow(userId, now, sleep, flow, running);
    setEntities(value => [...value.filter(item => item.id !== result.sleep.id && item.id !== result.run?.id), result.sleep, ...(result.run ? [result.run] : [])]);
  };
  const advanceFlow = async (runId: string, stepId: string, outcome: "completed" | "skipped", checkedItemIds: string[] = []) => {
    const run = entities.find(item => item.id === runId && item.type === "routineRun") as CoreEntity<RoutineRunData> | undefined;
    const flow = run ? active<RoutineFlowData>(entities, "routineFlow").find(item => item.id === run.payload.routineFlowId) : undefined;
    if (!run || !flow) return;
    const saved = await updateEntity(userId, run, advanceRoutineRun(flow, run, stepId, outcome, new Date(), checkedItemIds) as unknown as Record<string, unknown>);
    setEntities(value => value.map(item => item.id === saved.id ? saved : item));
  };
  const recordFatigue = async () => {
    const now = new Date();
    const saved = await createEntity(userId, "conditionRecord", { recordedAt: now.toISOString(), date: localDate(now), energyLevel: "low", fatigue: 3, mood: null, note: "今むり：疲れた", source: "manual", confidence: 1 });
    setEntities(value => [...value, saved]);
  };
  const tasks = active<TaskData>(entities, "task");
  const plans = active<PlanData>(entities, "plan");
  const inbox = active<InboxData>(entities, "inbox");
  const categories = active<CalendarCategoryData>(entities, "calendarCategory");
  const directions = active<DirectionData>(entities, "direction");
  const projects = active<ProjectData>(entities, "project");
  const settings = active<SettingsData>(entities, "settings")[0];
  const conflicts = active<ConflictData>(entities, "conflict").filter(
    (item) => item.payload.status === "open",
  );
  const todayPlans = plans
    .filter((p) => !p.payload.resolution && dayRange(p.payload.startAt, p.payload.endAt, clock))
    .sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt));
  const checks = unresolved(entities, clock);
  const nowPlan = scheduledPlans(todayPlans).find(
    (p) =>
      new Date(p.payload.startAt) <= clock && clock < new Date(p.payload.endAt),
  );
  const nextPlan = scheduledPlans(todayPlans).find((p) => new Date(p.payload.startAt) > clock);
  return (
    <div className="shell" data-active-tab={tab}>
      <DiaryNavigation tab={tab} setTab={setTab} checks={checks.length} userName={userName} syncState={syncState} onSignOut={onSignOut} />
      <main id="main-content" className="diary-main">
        <span className="diary-corner corner-left" aria-hidden="true" />
        <span className="diary-corner corner-right" aria-hidden="true" />
        <header>
          <div>
            <p>
              {clock.toLocaleDateString("ja-JP", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </p>
            <h1>{tab === "now" ? "今、何する？" : nav.find((n) => n[0] === tab)?.[1]}</h1>
          </div>
          <div className="header-actions">
            <button
              className="command-trigger"
              onClick={() => setCommandOpen(true)}
            >
              <Search size={16} />
              操作を検索 <kbd>Ctrl K</kbd>
            </button>
            <span className={`sync-state ${syncState}`}>{syncState}</span>
            <button
              className="capture"
              onClick={() => setModal({ kind: "inbox" })}
            >
              <Plus size={18} />
              記録する
            </button>
          </div>
        </header>
        {error && <div className="error">{error}</div>}
        {!loaded ? (
          <div className="loading">同期しています…</div>
        ) : (
          <div className="diary-page" key={tab}>
            {tab === "now" && (
              <NowView
                entities={entities}
                create={create}
                update={update}
                clock={clock}
                nowPlan={nowPlan}
                nextPlan={nextPlan}
                plans={todayPlans}
                tasks={tasks}
                inboxCount={inbox.filter(item => !item.payload.sorted).length}
                checks={checks.length}
                dayEnd={settings?.payload.dayEnd || "23:00"}
                setTab={setTab}
                setModal={setModal}
                beginExecution={beginExecution}
                endExecution={endExecution}
                recordWake={recordWake}
                advanceFlow={advanceFlow}
                recordFatigue={recordFatigue}
                notificationEntry={notificationEntry}
              />
            )}
            {tab === "today" && (
              <CalendarView
                key="today"
                todayOnly
                entities={entities}
                create={create}
                update={update}
                openCapture={(taskId, date, start, end) =>
                  setModal({ kind: "plan", taskId, date, start, end })
                }
                openEntity={(entity) =>
                  setModal({
                    kind: entity.type as Capture,
                    entityId: entity.id,
                  })
                }
              />
            )}
            {tab === "plan" && (
              <CalendarView
                key="plan"
                entities={entities}
                create={create}
                update={update}
                openCapture={(taskId, date, start, end) =>
                  setModal({ kind: "plan", taskId, date, start, end })
                }
                openEntity={(entity) =>
                  setModal({
                    kind: entity.type as Capture,
                    entityId: entity.id,
                  })
                }
              />
            )}
            {tab === "tasks" && (
              <TasksView
                tasks={tasks}
                plans={plans}
                projects={projects}
                categories={categories}
                setModal={setModal}
                update={update}
              />
            )}
            {tab === "projects" && (
              <ProjectsView
                entities={entities}
                create={create}
                update={update}
              />
            )}
            {tab === "routines" && (
              <RoutinesView
                entities={entities}
                create={create}
                update={update}
              />
            )}
            {tab === "money" && (
              <MoneyView entities={entities} create={create} update={update} />
            )}
            {tab === "inbox" && (
              <InboxView
                entities={entities}
                checks={checks}
                openCalendar={() => setTab("plan")}
                update={update}
                postpone={postpone}
                recordAsPlanned={recordAsPlanned}
                create={create}
                setModal={setModal}
              />
            )}
            {tab === "settings" && (
              <SettingsView
                 userId={userId}
                 entities={entities}
                 settings={settings}
                conflicts={conflicts}
                nowPlan={nowPlan}
                nextPlan={nextPlan}
                checks={checks.length}
                create={create}
                update={update}
                onConflictResolved={({ resolvedTarget, resolvedConflict }) =>
                  setEntities((items) =>
                    items.map((item) =>
                      item.id === resolvedTarget.id
                        ? resolvedTarget
                        : item.id === resolvedConflict.id
                          ? resolvedConflict
                          : item,
                    ),
                  )
                }
              />
            )}{" "}
          </div>
        )}
      </main>
      <button
        className="mobile-capture"
        onClick={() => setModal({ kind: "inbox" })}
      >
        <Plus />
        記録する
      </button>
      {commandOpen && (
        <CommandPalette
          close={() => setCommandOpen(false)}
          create={commandCreate}
          createMany={commandCreateMany}
          setTab={setTab}
          setModal={setModal}
        />
      )}{" "}
      {modal && (
        <CaptureModal
          modal={modal}
          entities={entities}
          tasks={tasks}
          plans={plans}
          categories={categories}
          projects={projects}
          directions={directions}
          close={() => setModal(null)}
          create={create}
          createLinkedActual={createLinkedActual}
          update={update}
          remove={remove}
        />
      )}
    </div>
  );
}

export function CommandPalette({
  close,
  create,
  createMany,
  setTab,
  setModal,
}: {
  close: () => void;
  create: (
    type: EntityType,
    payload: Record<string, unknown>,
  ) => Promise<CoreEntity>;
  createMany: (
    inputs: { type: EntityType; payload: Record<string, unknown> }[],
  ) => Promise<CoreEntity[]>;
  setTab: (tab: string) => void;
  setModal: (modal: Modal) => void;
}) {
  const [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const parsed = parseCommandBatch(query);
  const run = async () => {
    if (busy) return;
    if (!parsed) {
      setMessage("形式を確認してください。候補から選ぶこともできます。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const results = await executeCommandBatch(parsed, { create, createMany });
      if (results[0]?.kind === "navigate")
        setTab(results[0].destination || "now");
      close();
    } catch {
      setMessage(
        "実行できませんでした。入力内容と同期状態を確認してください。",
      );
    } finally {
      setBusy(false);
    }
  };
  const choices = [
    ["タスクを追加", () => setModal({ kind: "task" })],
    ["予定を追加", () => setModal({ kind: "plan" })],
    ["実績を追加", () => setModal({ kind: "actual" })],
    ["お金を記録", () => setTab("money")],
    ["今を見る", () => setTab("now")],
  ] as const;
  return (
    <DiaryDialog className="command-palette" labelledBy="command-title" close={close} busy={busy}>
        <div className="command-heading"><span className="diary-emblem command-emblem" aria-hidden="true" /><h2 id="command-title">コマンド入力</h2><button className="diary-icon-button" onClick={close} disabled={busy} aria-label="閉じる"><X size={18} /></button></div>
        <div className="command-search">
          <Search />
          <input
            autoFocus
            aria-label="操作を検索、またはコマンドを入力"
            disabled={busy}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void run(); }
            }}
            placeholder="操作を検索、またはコマンドを入力"
          />
          <kbd>Esc</kbd>
        </div>
        {query && (
          <div className="command-preview">
            {parsed ? (
              <>
                <span>
                  {parsed.length === 1 && parsed[0].type === "SHOW_NOW"
                    ? "「今」を開く"
                    : `${parsed.length}件をまとめて追加`}
                </span>
                <button disabled={busy} onClick={() => void run()}>
                  {busy ? "実行中…" : "実行"}
                </button>
              </>
            ) : (
              <small>
                1行に1件、または ; で区切ります。例：t レポート ; m 420
                電車
              </small>
            )}
          </div>
        )}
        {message && <p className="form-error">{message}</p>}
        <div className="command-list">
          {choices
            .filter(([label]) => !query || label.includes(query))
            .map(([label, action]) => (
              <button
                key={label}
                disabled={busy}
                onClick={() => {
                  action();
                  close();
                }}
              >
                {label}
                <span>›</span>
              </button>
            ))}
        </div>
        <p>
          Enter で実行 · Esc で閉じる。例：t レポート ; m 420 電車
        </p>
    </DiaryDialog>
  );
}

export function SettingsView({
  userId,
  entities,
  settings,
  conflicts,
  nowPlan,
  nextPlan,
  checks,
  create,
  update,
  onConflictResolved,
}: {
  userId: string;
  entities: CoreEntity[];
  settings?: CoreEntity<SettingsData>;
  conflicts: CoreEntity<ConflictData>[];
  nowPlan?: CoreEntity<PlanData>;
  nextPlan?: CoreEntity<PlanData>;
  checks: number;
  create: (t: EntityType, p: Record<string, unknown>) => Promise<void>;
  update: (e: CoreEntity, p: Record<string, unknown>) => Promise<void>;
  onConflictResolved: (
    result: Awaited<ReturnType<typeof resolveConflict>>,
  ) => void;
}) {
  const [start, setStart] = useState(settings?.payload.dayStart || "07:00"),
    [end, setEnd] = useState(settings?.payload.dayEnd || "23:00"),
    [guidanceIntensity, setGuidanceIntensity] = useState(settings?.payload.guidanceIntensity || "strong"),
    [transitionBuffer, setTransitionBuffer] = useState(String(settings?.payload.transitionBufferMinutes ?? 10)),
    [departureBuffer, setDepartureBuffer] = useState(String(settings?.payload.departureSafetyBufferMinutes ?? 10)),
    [targetSleep, setTargetSleep] = useState(settings?.payload.targetSleepTime || "23:30"),
    [windDown, setWindDown] = useState(String(settings?.payload.windDownMinutes ?? 45)),
    [fallbackWake, setFallbackWake] = useState(settings?.payload.fallbackWakeTime || "08:00"),
    [wakeWindow, setWakeWindow] = useState(String(settings?.payload.wakeWindowMinutes ?? 180)),
    [notificationsOn, setNotificationsOn] = useState(settings?.payload.notificationsEnabled ?? false),
    [wakeNotifications, setWakeNotifications] = useState(settings?.payload.wakeNotifications ?? true),
    [anchorNotifications, setAnchorNotifications] = useState(settings?.payload.anchorNotifications ?? true),
    [departureNotifications, setDepartureNotifications] = useState(settings?.payload.departureNotifications ?? true),
    [executionNotifications, setExecutionNotifications] = useState(settings?.payload.executionNotifications ?? true),
    [windDownNotifications, setWindDownNotifications] = useState(settings?.payload.windDownNotifications ?? true),
    [notificationMessage, setNotificationMessage] = useState(""),
    [nextWake, setNextWake] = useState(() => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); const date = localDate(tomorrow);
      const planned = active<SleepRecordData>(entities, "sleepRecord").find(item => item.payload.date === date)?.payload.plannedWakeAt;
      const candidate = planned ? new Date(planned) : new Date(`${date}T${settings?.payload.fallbackWakeTime || "08:00"}:00`);
      return `${localDate(candidate)}T${localTime(candidate)}`;
    }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [backups, setBackups] = useState<BackupSummary[]>([]),
    [backupError, setBackupError] = useState(""),
    [webhook, setWebhook] = useState(() =>
      typeof window === "undefined"
        ? ""
        : localStorage.getItem("liflow_discord_webhook_v1") || "",
    ),
    [discordMessage, setDiscordMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    void listBackups(userId)
      .then((items) => {
        if (!cancelled) setBackups(items.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled)
          setBackupError("バックアップ一覧を読み込めませんでした。");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const save = async () => {
    if (start >= end) {
      setMessage("一日の終了は開始より後にしてください。");
      return;
    }
    setBusy(true);
    setMessage("");
    const payload: SettingsData = {
      ...settings?.payload,
      calendarView: settings?.payload.calendarView || "week",
      visibleCalendarCategories:
        settings?.payload.visibleCalendarCategories || [],
      showPlan: settings?.payload.showPlan ?? true,
      showActual: settings?.payload.showActual ?? true,
      showTaskDeadlines: settings?.payload.showTaskDeadlines ?? true,
      dayStart: start,
      dayEnd: end,
      guidanceIntensity,
      transitionBufferMinutes: Math.max(0, Number(transitionBuffer) || 0),
      departureSafetyBufferMinutes: Math.max(0, Number(departureBuffer) || 0),
      targetSleepTime: targetSleep || null,
      windDownMinutes: Math.max(0, Number(windDown) || 0),
      fallbackWakeTime: fallbackWake || null,
      wakeWindowMinutes: Math.max(30, Number(wakeWindow) || 180),
      notificationsEnabled: notificationsOn,
      wakeNotifications,
      anchorNotifications,
      departureNotifications,
      executionNotifications,
      windDownNotifications,
    };
    try {
      if (settings) await update(settings, payload);
      else await create("settings", payload);
      if (nextWake) {
        const wake = new Date(nextWake), date = localDate(wake), planned = active<SleepRecordData>(entities, "sleepRecord").find(item => item.payload.date === date);
        await savePlannedWake(userId, date, wake.toISOString(), planned);
      }
      if (!notificationsOn) await disablePushNotifications(userId).catch(() => undefined);
      setMessage("保存しました。");
    } catch {
      /* 上位で同期エラーを表示する */
    } finally {
      setBusy(false);
    }
  };
  const enableNotifications = async () => {
    setBusy(true); setNotificationMessage("");
    try {
      const result = await enablePushNotifications(userId);
      if (result.enabled) { setNotificationsOn(true); setNotificationMessage("この端末への通知を有効にしました。設定を保存してください。"); }
      else setNotificationMessage("通知は許可されませんでした。アプリは通知なしでも使えます。");
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "";
      setNotificationMessage(code === "notification_not_configured" ? "Push配信用の公開鍵が未設定です。VAPID設定後に有効化できます。" : code === "notification_unsupported" ? "このブラウザはWeb Pushに対応していません。" : "通知を有効にできませんでした。ブラウザ設定を確認してください。");
    } finally { setBusy(false); }
  };
  const label = (payload: Record<string, unknown>) =>
    String(
      payload.title ||
        payload.name ||
        payload.text ||
        (typeof payload.amount === "number"
          ? `${payload.amount.toLocaleString("ja-JP")}円`
          : "内容を確認"),
    );
  const choose = async (
    conflict: CoreEntity<ConflictData>,
    choice: "local" | "remote",
  ) => {
    setBusy(true);
    try {
      const result = await resolveConflict(userId, conflict, choice);
      onConflictResolved(result);
      setMessage("競合を解決しました。");
    } catch {
      setMessage("競合を解決できませんでした。最新状態を確認してください。");
    } finally {
      setBusy(false);
    }
  };
  const restore = async (backup: BackupSummary) => {
    if (
      !window.confirm(
        `${new Date(backup.timestamp).toLocaleString("ja-JP")} の状態へ戻しますか？\n現在の状態は復元前に自動でバックアップします。`,
      )
    )
      return;
    setBusy(true);
    setBackupError("");
    try {
      await restoreBackup(userId, backup.id);
      window.location.reload();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setBackupError(
        code === "restore_conflict"
          ? "操作中に別の端末で更新されました。同期後にやり直してください。"
          : code === "restore_too_large"
            ? "この版ではデータ件数が多すぎて一括復元できません。"
            : "復元できませんでした。通信とFirestoreルールを確認してください。",
      );
    } finally {
      setBusy(false);
    }
  };
  const testDiscord = async () => {
    setBusy(true);
    setDiscordMessage("");
    try {
      localStorage.setItem("liflow_discord_webhook_v1", webhook.trim());
      const lines = [
        "Liflowからの確認です。",
        nowPlan ? `今：${nowPlan.payload.title}` : "今の予定はありません。",
        nextPlan
          ? `次：${displayTime(nextPlan.payload.startAt)} ${nextPlan.payload.title}`
          : "次の予定はありません。",
        `確認したいもの：${checks}件`,
      ];
      await sendToDiscord(webhook.trim(), lines.join("\n"));
      setDiscordMessage("Discordへ送信しました。");
    } catch {
      setDiscordMessage(
        "送信できませんでした。Webhook URLを確認してください。",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="settings-stack">
      <section className="panel settings-panel">
        <div>
          <p className="kicker">一日の時間</p>
          <h2>残り時間の計算</h2>
          <p>「今」に表示する空き時間は、この終了時刻までで計算します。</p>
        </div>
        <div className="time-inputs">
          <label>
            開始
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <ArrowRight />
          <label>
            終了
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <div className="form-pair">
          <label>案内の強さ<select value={guidanceIntensity} onChange={event => setGuidanceIntensity(event.target.value as NonNullable<SettingsData["guidanceIntensity"]>)}><option value="strong">強め（1つ決める）</option><option value="balanced">バランス</option><option value="light">軽め</option></select></label>
          <label>切替バッファ（分）<input type="number" min="0" step="1" value={transitionBuffer} onChange={event => setTransitionBuffer(event.target.value)} /></label>
          <label>出発安全バッファ（分）<input type="number" min="0" step="1" value={departureBuffer} onChange={event => setDepartureBuffer(event.target.value)} /></label>
          <label>就寝目標<input type="time" value={targetSleep} onChange={event => setTargetSleep(event.target.value)} /></label>
          <label>Wind Down（分）<input type="number" min="0" step="1" value={windDown} onChange={event => setWindDown(event.target.value)} /></label>
          <label>通常の起床候補<input aria-label="通常の起床候補" type="time" value={fallbackWake} onChange={event => setFallbackWake(event.target.value)} /></label>
          <label>起床確認の猶予（分）<input type="number" min="30" step="15" value={wakeWindow} onChange={event => setWakeWindow(event.target.value)} /></label>
          <label>次の起床予定<input aria-label="次の起床予定" type="datetime-local" value={nextWake} onChange={event => setNextWake(event.target.value)} /></label>
        </div>
        {message && (
          <p
            className={
              message === "保存しました。" || message === "競合を解決しました。"
                ? "settings-saved"
                : "form-error"
            }
          >
            {message}
          </p>
        )}
        <button className="save" disabled={busy} onClick={save}>
          {busy ? "処理中…" : "保存する"}
        </button>
      </section>
      <section className="panel settings-panel notification-settings">
        <div><p className="kicker">PWA・通知</p><h2>Liflowから境界を知らせる</h2><p>許可ボタンを押した時だけブラウザへ確認します。拒否しても通常機能は変わりません。</p></div>
        <p className="notification-capability">現在：{notificationCapability() === "granted" ? "このブラウザで許可済み" : notificationCapability() === "denied" ? "ブラウザで拒否中" : notificationCapability() === "not-configured" ? "配信用公開鍵が未設定" : notificationCapability() === "unsupported" ? "このブラウザは非対応" : "まだ確認していません"}</p>
        <button className="diary-button primary" disabled={busy} onClick={() => void enableNotifications()}>通知を許可する</button>
        <label className="checkbox-label"><input type="checkbox" checked={notificationsOn} onChange={event => setNotificationsOn(event.target.checked)}/>通知全体を有効にする</label>
        <div className="notification-options">
          <label className="checkbox-label"><input type="checkbox" checked={wakeNotifications} onChange={event => setWakeNotifications(event.target.checked)}/>起床・支度</label>
          <label className="checkbox-label"><input type="checkbox" checked={anchorNotifications} onChange={event => setAnchorNotifications(event.target.checked)}/>固定予定の接近</label>
          <label className="checkbox-label"><input type="checkbox" checked={departureNotifications} onChange={event => setDepartureNotifications(event.target.checked)}/>出発</label>
          <label className="checkbox-label"><input type="checkbox" checked={executionNotifications} onChange={event => setExecutionNotifications(event.target.checked)}/>実行の切り上げ</label>
          <label className="checkbox-label"><input type="checkbox" checked={windDownNotifications} onChange={event => setWindDownNotifications(event.target.checked)}/>Wind Down</label>
        </div>
        {notificationMessage && <p className="settings-saved" role="status">{notificationMessage}</p>}
      </section>
      <section className="panel settings-panel">
        <p className="kicker">同期の競合</p>
        <h2>どちらの変更を残す？</h2>
        {conflicts.length ? (
          conflicts.map((conflict) => (
            <article className="conflict-card" key={conflict.id}>
              <p>
                {new Date(conflict.payload.detectedAt).toLocaleString("ja-JP")}{" "}
                に、同じ項目が別の端末でも変更されました。
              </p>
              <div className="conflict-choices">
                <button
                  disabled={busy}
                  onClick={() => void choose(conflict, "local")}
                >
                  <small>この端末</small>
                  <b>{label(conflict.payload.localPayload)}</b>
                </button>
                <button
                  disabled={busy}
                  onClick={() => void choose(conflict, "remote")}
                >
                  <small>クラウド</small>
                  <b>{label(conflict.payload.remotePayload)}</b>
                </button>
              </div>
            </article>
          ))
        ) : (
          <Empty text="確認が必要な競合はありません" />
        )}
      </section>
      <section className="panel settings-panel">
        <p className="kicker">バックアップ</p>
        <h2>以前の状態へ戻す</h2>
        <p>
          復元前にも現在の状態を保存します。端末全体の上書き同期には使いません。
        </p>
        {backupError && <p className="form-error">{backupError}</p>}
        <div className="backup-list">
          {backups.map((backup) => (
            <div className="backup-row" key={backup.id}>
              <div>
                <b>{new Date(backup.timestamp).toLocaleString("ja-JP")}</b>
                <small>
                  {backup.dataCount}件 · schema {backup.schemaVersion}
                </small>
              </div>
              <button disabled={busy} onClick={() => void restore(backup)}>
                この時点へ戻す
              </button>
            </div>
          ))}
          {!backups.length && !backupError && (
            <Empty text="利用できるバックアップはまだありません" />
          )}
        </div>
      </section>
      <section className="panel settings-panel">
        <p className="kicker">Discord</p>
        <h2>Discordへ送る</h2>
        <p>
          Webhook
          URLはこの端末だけに保存し、Firestoreやバックアップには含めません。
        </p>
        <label>
          Webhook URL
          <input
            type="password"
            value={webhook}
            onChange={(event) => setWebhook(event.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
          />
        </label>
        {discordMessage && (
          <p
            className={
              discordMessage.includes("送信しました")
                ? "settings-saved"
                : "form-error"
            }
          >
            {discordMessage}
          </p>
        )}
        <button
          className="save"
          disabled={busy || !webhook.trim()}
          onClick={() => void testDiscord()}
        >
          {busy ? "送信中…" : "現在の状況をテスト送信"}
        </button>
      </section>
    </div>
  );
}

export function CaptureModal({
  modal,
  entities,
  tasks,
  plans,
  categories,
  projects,
  directions,
  close,
  create,
  createLinkedActual,
  update,
  remove,
}: {
  modal: NonNullable<Modal>;
  entities: CoreEntity[];
  tasks: CoreEntity<TaskData>[];
  plans: CoreEntity<PlanData>[];
  categories: CoreEntity<CalendarCategoryData>[];
  projects: CoreEntity<ProjectData>[];
  directions: CoreEntity<DirectionData>[];
  close: () => void;
  create: (t: EntityType, p: Record<string, unknown>) => Promise<void>;
  createLinkedActual: (
    plan: CoreEntity<PlanData>,
    payload: ActualData,
  ) => Promise<void>;
  update: (
    e: CoreEntity,
    p: Record<string, unknown>,
    deleted?: boolean,
  ) => Promise<void>;
  remove: (e: CoreEntity) => Promise<void>;
}) {
  const editing = modal.entityId
    ? entities.find((e) => e.id === modal.entityId)
    : undefined;
  const editingPayload = (editing?.payload || {}) as Record<string, unknown>;
  const linkedPlan = plans.find((p) => p.id === modal.planId);
  const plan = (editing?.type === "plan" ? editing : linkedPlan) as
    CoreEntity<PlanData> | undefined;
  const task = (
    editing?.type === "task"
      ? editing
      : tasks.find((t) => t.id === (modal.taskId || plan?.payload.taskId))
  ) as CoreEntity<TaskData> | undefined;
  const startValue =
      typeof editingPayload.startAt === "string"
        ? editingPayload.startAt
        : plan?.payload.startAt,
    endValue =
      typeof editingPayload.endAt === "string"
        ? editingPayload.endAt
        : plan?.payload.endAt;
  const initialStart = startValue ? new Date(startValue) : modal.start ? new Date(`${modal.date || localDate()}T${modal.start}:00`) : new Date(),
    initialEnd = new Date(initialStart.getTime() + 60 * 60000);
  const originalAllDay = Boolean(editingPayload.allDay || plan?.payload.allDay);
  const inclusiveEndDay = (value: string) => localDate(new Date(+new Date(value) - 1));
  const [kind, setKind] = useState<Capture>(modal.kind),
    [title, setTitle] = useState(
      String(
        editingPayload.title ||
          editingPayload.text ||
          plan?.payload.title ||
          task?.payload.title ||
          "",
      ),
    ),
    [date, setDate] = useState(modal.date || localDate(initialStart)),
    [endDate, setEndDate] = useState(endValue ? originalAllDay && modal.kind === "plan" ? inclusiveEndDay(endValue) : localDate(new Date(endValue)) : modal.end ? modal.date || localDate(initialStart) : localDate(initialEnd)),
    [start, setStart] = useState(modal.start || localTime(initialStart)),
    [end, setEnd] = useState(
      modal.end || (endValue ? localTime(new Date(endValue)) : modal.start ? localTime(new Date(new Date(`${modal.date || localDate(initialStart)}T${modal.start}:00`).getTime() + 60 * 60000)) : localTime(initialEnd)),
    ),
    [due, setDue] = useState(
      task?.payload.deadline ? localDate(new Date(task.payload.deadline)) : "",
    ),
    [projectId, setProjectId] = useState(
      String(
        editingPayload.projectId ||
          plan?.payload.projectId ||
          task?.payload.projectId ||
          "",
      ),
    ),
    [parentTaskId, setParentTaskId] = useState(
      task?.payload.parentTaskId || "",
    ),
    [categoryId, setCategoryId] = useState(
      String(
        editingPayload.calendarCategoryId ||
          plan?.payload.calendarCategoryId ||
          task?.payload.calendarCategoryId ||
          "",
      ),
    ),
    [directionId, setDirectionId] = useState(
      typeof editingPayload.directionId === "string" ? editingPayload.directionId : "",
    ),
    [remainingEstimate, setRemainingEstimate] = useState(
      typeof task?.payload.estimatedRemainingMinutes === "number" ? String(task.payload.estimatedRemainingMinutes) : "",
    ),
    [nextActionTitle, setNextActionTitle] = useState(task?.payload.nextAction?.title || ""),
    [planType, setPlanType] = useState<PlanData["type"]>(
      (editingPayload.type as PlanData["type"]) ||
        plan?.payload.type ||
        (modal.taskId ? "task" : "personal"),
    ),
    [allDay, setAllDay] = useState(
      Boolean(editingPayload.allDay || plan?.payload.allDay),
    ),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const project = projects.find((p) => p.id === projectId);
  const effectiveCategory = inheritedCategory(
    categoryId,
    plan?.payload.calendarCategoryId,
    task?.payload.calendarCategoryId,
    project?.payload.calendarCategoryId,
  );
  const changeProject = (id: string) => {
    setProjectId(id);
    const p = projects.find((x) => x.id === id);
    if (!categoryId && p?.payload.calendarCategoryId)
      setCategoryId(p.payload.calendarCategoryId);
  };
  const save = async () => {
    if (!title.trim() || busy) return;
    setFormError("");
    const isAllDay = kind === "plan" && allDay;
    const preserveTime = (day: string, time: string, previous?: string) => previous && day === localDate(new Date(previous)) && time === localTime(new Date(previous)) ? previous : toIso(day, time);
    const endOfDay = (day: string) => { const next = new Date(`${day}T00:00:00`); next.setDate(next.getDate() + 1); return next.toISOString(); };
    if (
      (kind === "plan" || kind === "actual") &&
      (!date || !endDate || (!isAllDay && (!start || !end)) ||
      !validTimeRange(toIso(date, isAllDay ? "00:00" : start), toIso(endDate, isAllDay ? "23:59" : end)))
    ) {
      setFormError("終了日時は開始日時より後にしてください。");
      return;
    }
    if (kind === "task" && task && parentTaskId) {
      const parents = new Map(tasks.map((t) => [t.id, t.payload.parentTaskId]));
      if (wouldCreateCycle(task.id, parentTaskId, parents)) {
        setFormError("この親タスクを選ぶと循環するため保存できません。");
        return;
      }
    }
    setBusy(true);
    try {
      let payload: Record<string, unknown> = {};
      if (kind === "task")
        payload = {
          ...task?.payload,
          title: title.trim(),
          description: task?.payload.description || "",
          deadline: due ? task?.payload.deadline && due === localDate(new Date(task.payload.deadline)) ? task.payload.deadline : toIso(due, "23:59") : null,
          estimateMinutes: task?.payload.estimateMinutes || null,
          estimatedRemainingMinutes: remainingEstimate ? Number(remainingEstimate) : null,
          nextAction: nextActionTitle.trim() ? { ...(task?.payload.nextAction || {}), title: nextActionTitle.trim(), generatedBy: "manual" } : null,
          directionId: directionId || null,
          projectId: projectId || null,
          parentTaskId: parentTaskId || null,
          calendarCategoryId: effectiveCategory,
          status: task?.payload.status || "open",
          completedAt: task?.payload.completedAt || null,
        };
      if (kind === "plan")
        payload = {
          ...plan?.payload,
          title: title.trim(),
          taskId: modal.taskId || plan?.payload.taskId || null,
          projectId: projectId || null,
          calendarCategoryId: effectiveCategory,
          directionId: directionId || null,
          startAt: allDay ? originalAllDay && startValue && date === localDate(new Date(startValue)) ? startValue : toIso(date, "00:00") : preserveTime(date, start, startValue),
          endAt: allDay ? originalAllDay && endValue && endDate === inclusiveEndDay(endValue) ? endValue : endOfDay(endDate) : preserveTime(endDate, end, endValue),
          type: planType,
          flexibility: plan?.payload.flexibility || "fixed",
          allDay,
          resolution: plan?.payload.resolution || null,
          rescheduledFromPlanId: plan?.payload.rescheduledFromPlanId || null,
          rescheduledToPlanId: plan?.payload.rescheduledToPlanId || null,
        };
      if (kind === "actual")
        payload = {
          ...editingPayload,
          title: title.trim(),
          taskId: String(editingPayload.taskId || task?.id || "") || null,
          planId: String(editingPayload.planId || modal.planId || "") || null,
          projectId: projectId || null,
          calendarCategoryId: effectiveCategory,
          directionId: directionId || null,
          startAt: preserveTime(date, start, startValue),
          endAt: preserveTime(endDate, end, endValue),
          type: String(editingPayload.type || plan?.payload.type || planType),
          note: String(editingPayload.note || ""),
        };
      if (kind === "inbox")
        payload = {
          ...editingPayload,
          text: title.trim(),
          sorted: Boolean(editingPayload.sorted),
        };
      if (editing) await update(editing, payload);
      else if (kind === "actual" && plan)
        await createLinkedActual(plan, payload as ActualData);
      else await create(kind, payload);
      close();
    } catch {
      setFormError("保存できませんでした。入力内容を残しています。通信や最新の同期状態を確認してください。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <DiaryDialog className="modal" labelledBy="capture-title" close={close} busy={busy}>
        <button className="modal-close" onClick={close} disabled={busy} aria-label="閉じる">
          <X />
        </button>
        <h2 id="capture-title">{editing ? "編集する" : "記録する"}</h2>
        {!editing && (
          <div className="kind-tabs">
            {(["task", "plan", "actual", "inbox"] as Capture[]).map((k, i) => (
              <button
                key={k}
                className={kind === k ? "active" : ""}
                onClick={() => setKind(k)}
              >
                {["タスク", "予定", "実績", "あとで整理"][i]}
              </button>
            ))}
          </div>
        )}
        <label>
          {kind === "inbox" ? "メモ" : "名前"}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              kind === "inbox" ? "考えずにそのまま入力" : "何をする？"
            }
          />
        </label>
        {kind !== "inbox" && (
          <div className="form-pair">
            <label>
              プロジェクト
              <select aria-label="プロジェクト"
                value={projectId}
                onChange={(e) => changeProject(e.target.value)}
              >
                <option value="">なし</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.payload.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              カレンダー
              <select aria-label="カレンダー"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">なし</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.payload.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {kind !== "inbox" && (
          <label>
            方向
            <select aria-label="方向" value={directionId} onChange={(event) => setDirectionId(event.target.value)}>
              <option value="">未指定</option>
              {directions.filter(item => item.payload.active || item.id === directionId).sort((a, b) => a.payload.sortOrder - b.payload.sortOrder).map(item => (
                <option key={item.id} value={item.id}>{item.payload.name}</option>
              ))}
            </select>
            {!directionId && task?.payload.directionId && kind !== "task" && (
              <small className="field-hint">{directions.find(item => item.id === task.payload.directionId)?.payload.name || "Taskの方向"}（Taskから継承）</small>
            )}
          </label>
        )}
        {kind === "task" && (
          <>
            <label>
              親タスク（任意）
              <select aria-label="親タスク（任意）"
                value={parentTaskId}
                onChange={(e) => setParentTaskId(e.target.value)}
              >
                <option value="">なし</option>
                {tasks.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.payload.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              締切（任意）
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <div className="form-pair">
              <label>残り見積（分・任意）<input type="number" min="0" step="1" inputMode="numeric" value={remainingEstimate} onChange={event => setRemainingEstimate(event.target.value)} /></label>
              <label>次の一手（任意）<input value={nextActionTitle} onChange={event => setNextActionTitle(event.target.value)} placeholder="まず何をする？" /></label>
            </div>
          </>
        )}
        {kind === "plan" && (
          <div className="form-pair">
            <label>
              種類
              <select aria-label="種類"
                value={planType}
                onChange={(e) =>
                  setPlanType(e.target.value as PlanData["type"])
                }
              >
                <option value="task">タスク</option>
                <option value="appointment">予定</option>
                <option value="travel">移動</option>
                <option value="rest">休憩</option>
                <option value="sleep">睡眠</option>
                <option value="personal">個人</option>
                <option value="container">期間</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              終日
            </label>
          </div>
        )}
        {(kind === "plan" || kind === "actual") && (
          <>
            <label>
              日付
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next && date && endDate) {
                    const offset = +new Date(next + "T12:00:00") - +new Date(date + "T12:00:00");
                    setEndDate(localDate(new Date(+new Date(endDate + "T12:00:00") + offset)));
                  }
                  setDate(next);
                }}
              />
            </label>
            <label>終了日<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}/></label>
            {!(kind === "plan" && allDay) && (
              <div className="time-inputs">
                <label>
                  開始
                  <input
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <ArrowRight />
                <label>
                  終了
                  <input
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
              </div>
            )}
          </>
        )}
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <button
          className="save"
          disabled={busy || !title.trim()}
          onClick={save}
        >
          {busy ? "保存中…" : "保存する"}
        </button>
        {editing && (
          <button
            className="delete-entity"
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try {
                await remove(editing);
                close();
              } catch {
                setFormError("削除できませんでした。最新の同期状態を確認してください。");
              } finally { setBusy(false); }
            }}
          >
            <Trash2 />
            削除する
          </button>
        )}
    </DiaryDialog>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export default function Liflow(props: { userName: string; userId: string; onSignOut: () => void }) {
  return <DiaryThemeProvider><LiflowApp {...props} /></DiaryThemeProvider>;
}
