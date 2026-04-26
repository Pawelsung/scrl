const CACHE_NAME = "scrl-cache-v2";
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const toScopedPath = (path) => `${BASE_PATH}${path}`;
const APP_SHELL = [
  toScopedPath("/"),
  toScopedPath("/manifest.webmanifest"),
  toScopedPath("/pwa-icon.svg"),
  toScopedPath("/pwa-maskable.svg"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(toScopedPath("/")));
    })
  );
});
