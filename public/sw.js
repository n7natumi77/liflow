const CACHE = "liflow-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/liflow-app.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/")));
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { notification: { body: event.data?.text() || "Liflowを開いて、今を確認しよう。" } }; }
  const notification = payload.notification || payload.data || {};
  const data = payload.data || notification.data || {};
  event.waitUntil(self.registration.showNotification(notification.title || "Liflow", {
    body: notification.body || "今を確認しよう。",
    icon: "/icons/liflow-app.svg",
    badge: "/icons/liflow-maskable.svg",
    tag: data.dedupeKey || notification.tag || "liflow",
    renotify: false,
    data: { href: data.href || notification.click_action || "/" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.href || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return self.clients.openWindow(target);
  }));
});
