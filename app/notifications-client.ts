"use client";
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";
import { firebaseApp } from "./firebase-client";
import {
  disableStoredDeviceSubscription,
  localDeviceId,
  saveDeviceSubscription,
} from "./firebase-store";

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export async function registerPwaServiceWorker(onUpdate?: (registration: ServiceWorkerRegistration) => void) {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  if (registration.waiting) onUpdate?.(registration);
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) onUpdate?.(registration);
    });
  });
  return registration;
}

export async function pwaDiagnostics() {
  if (!("serviceWorker" in navigator)) return { supported: false, controlled: false, version: "-", updateReady: false };
  const registration = await navigator.serviceWorker.getRegistration("/");
  let version = "unknown";
  const worker = registration?.active || registration?.waiting || registration?.installing;
  if (worker) {
    version = await new Promise<string>(resolve => {
      const channel = new MessageChannel();
      const timer = window.setTimeout(() => resolve("unknown"), 1200);
      channel.port1.onmessage = event => { window.clearTimeout(timer); resolve(String(event.data?.version || "unknown")); };
      worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
    });
  }
  return { supported: true, controlled: Boolean(navigator.serviceWorker.controller), version, updateReady: Boolean(registration?.waiting) };
}

export async function applyPwaUpdate() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
}

export async function listenForForegroundNotifications(onPayload: (payload: MessagePayload) => void) {
  if (!(await isSupported())) return () => undefined;
  return onMessage(getMessaging(firebaseApp), onPayload);
}

export function notificationCapability() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported" as const;
  if (!vapidKey) return "not-configured" as const;
  return Notification.permission;
}

export async function enablePushNotifications(uid: string) {
  if (!(await isSupported()) || !("serviceWorker" in navigator)) throw new Error("notification_unsupported");
  if (!vapidKey) throw new Error("notification_not_configured");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { permission, enabled: false };
  const registration = await registerPwaServiceWorker();
  if (!registration) throw new Error("notification_unsupported");
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("notification_token_missing");
  await saveDeviceSubscription(uid, {
    deviceId: localDeviceId(),
    token,
    platform: navigator.userAgent,
  });
  return { permission, enabled: true };
}

export async function refreshPushSubscription(uid: string) {
  if (notificationCapability() !== "granted" || !(await isSupported())) return false;
  const registration = await registerPwaServiceWorker();
  if (!registration) return false;
  const token = await getToken(getMessaging(firebaseApp), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return false;
  await saveDeviceSubscription(uid, { deviceId: localDeviceId(), token, platform: navigator.userAgent });
  return true;
}

export async function disablePushNotifications(uid: string) {
  if (await isSupported()) await deleteToken(getMessaging(firebaseApp)).catch(() => false);
  await disableStoredDeviceSubscription(uid);
}
