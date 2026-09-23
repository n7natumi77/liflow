"use client";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { firebaseApp } from "./firebase-client";
import {
  disableStoredDeviceSubscription,
  localDeviceId,
  saveDeviceSubscription,
} from "./firebase-store";

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export async function registerPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
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
