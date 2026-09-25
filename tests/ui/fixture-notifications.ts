export async function registerPwaServiceWorker() { return null; }
export async function pwaDiagnostics() { return { supported: true, controlled: true, version: "fixture", updateReady: false }; }
export async function applyPwaUpdate() { return undefined; }
export async function listenForForegroundNotifications() { return () => undefined; }
export function notificationCapability() { return "default" as const; }
let denyNext = false;
export async function enablePushNotifications() { if (denyNext) { denyNext = false; return { permission: "denied" as const, enabled: false }; } return { permission: "granted" as const, enabled: true }; }
export async function refreshPushSubscription() { return true; }
export async function disablePushNotifications() { return undefined; }
declare global { interface Window { __notificationFixture: { denyNext(): void } } }
window.__notificationFixture = { denyNext: () => { denyNext = true; } };
