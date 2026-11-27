/** Shell cache plus notification taps that open the approval sheet. */
const CACHE = "iris-shell-v56";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./shell.js",
  "./boot.js",
  "./css/remote-a.css",
  "./css/remote-b.css",
  "./css/iris-gate.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const path = new URL(req.url).pathname;
  if (/\.(js|css|html)$/.test(path)) {
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req)),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL("./?approval=1", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.startsWith(self.registration.scope));
      if (open) {
        open.postMessage({ type: "approval" });
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
