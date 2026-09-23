export type Capture = "task" | "plan" | "actual" | "money" | "inbox";
export type CaptureState = { kind: Capture; taskId?: string; planId?: string; entityId?: string; date?: string; start?: string; end?: string } | null;
