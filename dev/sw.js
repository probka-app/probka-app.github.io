// YuVi: офлайн-заглушка і швидкий старт. Завжди спершу мережа — щоб у всіх була свіжа версія.
const C = "yuvi-v1";
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(["/", "/icon-192.png"])).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put("/", cp)).catch(() => {}); return res; })
      .catch(() => caches.match("/").then(m => m || new Response("<meta charset=utf-8><p style='font:16px sans-serif;padding:24px'>Немає інтернету. Перевір з'єднання і спробуй ще раз.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } }))));
  }
});
