export const PRODUCTION_ENVIRONMENT = [
  { name: "NEXT_PUBLIC_FIREBASE_VAPID_KEY", kind: "public", required: false, purpose: "Web Push購読" },
  { name: "FIREBASE_SERVICE_ACCOUNT_JSON", kind: "secret", required: true, purpose: "Discord APIからFirestoreへ接続" },
  { name: "DISCORD_PUBLIC_KEY", kind: "secret", required: true, purpose: "Discord署名検証" },
  { name: "DISCORD_TRUSTED_CHANNEL_IDS", kind: "variable", required: true, purpose: "参照可能Channel制限" },
  { name: "DISCORD_ALLOWED_USER_IDS", kind: "variable", required: true, purpose: "更新可能User制限" },
  { name: "LIFLOW_FIREBASE_UID", kind: "secret", required: true, purpose: "Discordが操作するLiflow UID" },
  { name: "LIFLOW_BUILD_ID", kind: "variable", required: false, purpose: "診断表示用Build ID" },
  { name: "APP_ORIGIN", kind: "variable", required: false, purpose: "通知クリック先Origin" },
] as const;

export function validateProductionEnvironment(environment: Record<string, string | undefined>) {
  const missing = PRODUCTION_ENVIRONMENT.filter(item => item.required && !environment[item.name]?.trim()).map(item => item.name);
  const configured = PRODUCTION_ENVIRONMENT.filter(item => Boolean(environment[item.name]?.trim())).map(item => item.name);
  return { valid: missing.length === 0, missing, configured };
}
