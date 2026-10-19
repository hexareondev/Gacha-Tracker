/* PityReon — офлайн-работа.
   Свои файлы берутся из сети, если она есть (так всегда открывается свежая версия),
   и сохраняются в кеш; без сети страница открывается из кеша. Шрифты — из кеша
   с фоновым обновлением. Остальные внешние адреса (портреты, базы) не трогаем. */
const CACHE = "gacha-tracker-v39";
const SHELL = [
  "./", "index.html", "css/style.css",
  "js/core.js", "js/calendar.js", "js/history.js", "js/pools.js", "js/collection.js", "js/showcase-alt.js", "js/showcase.js", "js/backup.js", "js/settings.js",
  "js/pulls.js", "js/achievements.js", "js/odds.js", "js/share.js", "js/sync.js", "js/nav.js",
  "manifest.webmanifest", "favicon.svg",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  // cache:"reload" — мимо HTTP-кеша браузера, иначе GitHub Pages ещё 10 минут отдаёт старые файлы
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache:"reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);

  if(url.origin === location.origin){
    e.respondWith(
      // no-cache — сверка с сервером по ETag: свежий файл сразу после обновления сайта
      fetch(new Request(req.url, { cache:"no-cache", credentials:"same-origin" })).then(res => {
        if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then(hit =>
          hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))
      )
    );
    return;
  }

  if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com"){
    e.respondWith(
      caches.open(CACHE).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
  }
});
