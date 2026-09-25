const VERSION = "2026.09.25-3";
const CACHE = `liflow-shell-${VERSION}`;
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/liflow-app.svg",
  "/icons/liflow-maskable.svg",
  "/icons/liflow-app-192.png",
  "/icons/liflow-app-512.png",
  "/icons/liflow-maskable-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("liflow-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "GET_VERSION") {
    const target = event.ports?.[0] || event.source;
    target?.postMessage({ type: "LIFLOW_SW_VERSION", version: VERSION });
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) void caches.open(CACHE).then(cache => cache.put("/", response.clone()));
      return response;
    }).catch(() => caches.match(request).then(response => response || caches.match("/"))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response.ok) void caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    });
    return cached || network;
  }));
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { notification: { body: event.data?.text() || "Liflowを開いて、今を確認しよう。" } }; }
  const notification = payload.notification || payload.data || {};
  const data = payload.data || notification.data || {};
  event.waitUntil(self.registration.showNotification(notification.title || "Liflow", {
    body: notification.body || "今を確認しよう。",
    icon: "/icons/liflow-app-192.png",
    badge: "/icons/liflow-maskable-512.png",
    tag: data.dedupeKey || notification.tag || "liflow",
    renotify: false,
    data: { href: data.href || notification.click_action || "/?notification=push" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.href || "/?notification=push", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return self.clients.openWindow(target);
  }));
});
