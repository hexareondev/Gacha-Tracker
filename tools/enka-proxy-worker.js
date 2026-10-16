// Посредник для Enka.Network на Cloudflare Workers (бесплатный тариф).
// Нужен, только если браузер не пускает Гача Трекер к Enka напрямую.
// Пропускает лишь запросы витрины по UID и добавляет заголовок, разрешающий чтение со страницы.
//
// 1. dash.cloudflare.com → Workers & Pages → Create → Worker → вставьте этот код → Deploy.
// 2. Скопируйте адрес вида https://<имя>.<аккаунт>.workers.dev
// 3. В Гача Трекере: Настройки → Витрина → «Адрес посредника».

export default {
  async fetch(req) {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (req.method !== "GET" || !/^\/api\/(zzz\/|hsr\/)?uid\/\d{6,12}\/?$/.test(url.pathname)) {
      return new Response("Только /api/[zzz|hsr]/uid/<UID>", { status: 404, headers: cors });
    }
    const res = await fetch("https://enka.network" + url.pathname, {
      headers: { "User-Agent": "gacha-tracker-proxy" },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    const headers = new Headers(res.headers);
    Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
    return new Response(res.body, { status: res.status, headers });
  },
};
