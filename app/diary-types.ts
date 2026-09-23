export type Capture = "task" | "plan" | "actual" | "inbox";
export type CaptureState = { kind: Capture; taskId?: string; planId?: string; entityId?: string; date?: string; start?: string; end?: string } | null;
