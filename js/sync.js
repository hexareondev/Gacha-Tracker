"use strict";
/* ── синхронизация через GitHub Gist (по желанию) ──
   Резервная копия кладётся в секретный gist аккаунта самого пользователя: у каждого,
   кто пользуется сайтом, — свой токен и свой gist. Токен хранится только в этом
   браузере и в резервную копию не попадает. Загрузка из облака работает как
   загрузка резервной копии: крутки и история заменяются, календарь и отметки
   достижений объединяются. */
const SYNC_KEY = "zzz-sync-v1";
const sstore = makeStore(SYNC_KEY);
const sync = sstore.load() || {};
const GIST_FILE = "gacha-tracker.json";
const GIST_DESC = "Гача Трекер — резервная копия";
function syncSave(){ sstore.save(sync); }
function backupText(){ return JSON.stringify({ v:3, rewards:data, pulls:pdata, gacha:hdata, ach:adata }); }

async function gh(path, opts){
  opts = opts || {};
  const headers = { "Accept":"application/vnd.github+json", "Authorization":"Bearer " + sync.token };
  if(opts.body) headers["Content-Type"] = "application/json";
  let r;
  try { r = await fetch("https://api.github.com" + path, { method: opts.method || "GET", headers, body: opts.body, cache:"no-store" }); }
  catch(e){ const err = new Error("нет связи с GitHub"); err.status = 0; throw err; }
  if(!r.ok){
    const err = new Error(
      r.status === 401 ? "токен не подходит или истёк" :
      r.status === 403 ? "у токена нет права на gist (или GitHub временно ограничил запросы)" :
      r.status === 404 ? "не найдено" :
      r.status === 422 ? "GitHub не принял данные" : "GitHub ответил " + r.status);
    err.status = r.status;
    throw err;
  }
  return r.status === 204 ? null : r.json();
}
async function findGist(){
  if(sync.gist){
    try { return await gh("/gists/" + sync.gist); }
    catch(e){ if(e.status !== 404) throw e; sync.gist = null; syncSave(); }
  }
  for(let page = 1; page <= 5; page++){
    const list = await gh("/gists?per_page=100&page=" + page);
    const hit = list.find(x => x.files && x.files[GIST_FILE]);
    if(hit){ sync.gist = hit.id; syncSave(); return await gh("/gists/" + hit.id); }
    if(list.length < 100) break;
  }
  return null;
}
async function syncPush(){
  const files = {}; files[GIST_FILE] = { content: backupText() };
  const body = JSON.stringify({ description: GIST_DESC, files });
  const g = await findGist();
  const res = g
    ? await gh("/gists/" + g.id, { method:"PATCH", body })
    : await gh("/gists", { method:"POST", body: JSON.stringify({ description: GIST_DESC, public:false, files }) });
  sync.gist = res.id;
  sync.pushed = Date.now();
  syncSave();
}
async function syncPull(){
  const g = await findGist();
  if(!g){ const e = new Error("в вашем GitHub пока нет копии — сначала отправьте её с устройства, где есть данные"); e.status = 404; throw e; }
  const f = g.files[GIST_FILE];
  let text = f.content;
  if(f.truncated || !text){                      // большие файлы GitHub отдаёт отдельной ссылкой
    const r = await fetch(f.raw_url, { cache:"no-store" });
    if(!r.ok) throw new Error("не удалось скачать копию (" + r.status + ")");
    text = await r.text();
  }
  return { text, updated: g.updated_at };
}

function syncWhen(t){
  return new Date(t).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function renderSync(msg, bad){
  const on = !!sync.token;
  document.getElementById("syncTokenRow").classList.toggle("hidden", on);
  document.getElementById("syncActs").classList.toggle("hidden", !on);
  ["menuSyncPush","menuSyncPull"].forEach(id => document.getElementById(id).classList.toggle("hidden", !on));
  document.getElementById("menuSyncSep").classList.toggle("hidden", !on);
  const st = document.getElementById("syncStatus");
  st.classList.toggle("bad", !!bad);
  st.textContent = msg || (on
    ? "Токен сохранён в этом браузере." + (sync.pushed ? " Последняя отправка с этого устройства: " + syncWhen(sync.pushed) + "." : "") +
      (sync.pulled ? " Последняя загрузка: " + syncWhen(sync.pulled) + "." : "")
    : "Не настроено.");
}
let syncBusy = false;
async function doSyncPush(){
  if(syncBusy) return;
  syncBusy = true; renderSync("Отправляю…");
  try { await syncPush(); renderSync("Отправлено " + syncWhen(sync.pushed) + "."); note("Копия отправлена в GitHub."); }
  catch(e){ renderSync("Не отправлено: " + e.message + ".", true); note("Не отправлено: " + e.message + "."); }
  syncBusy = false;
}
async function doSyncPull(){
  if(syncBusy) return;
  syncBusy = true; renderSync("Загружаю…");
  let got;
  try { got = await syncPull(); }
  catch(e){ renderSync("Не загружено: " + e.message + ".", true); note("Не загружено: " + e.message + "."); syncBusy = false; return; }
  syncBusy = false;
  renderSync();
  askConfirm("Загрузить копию из GitHub?",
    "Копия от " + syncWhen(got.updated) + ". Крутки и история круток на этом устройстве заменятся копией, " +
    "а календарь и отметки достижений объединятся с ней.",
    "Загрузить",
    () => {
      if(merge(got.text)){
        sync.pulled = Date.now(); syncSave();
        renderSync("Загружено " + syncWhen(sync.pulled) + ".");
        setNav(curNav(), ui.tab);
      }
    }, true);
}
document.getElementById("syncSaveToken").onclick = () => {
  const v = document.getElementById("syncToken").value.trim();
  if(!v){ document.getElementById("syncToken").focus(); return; }
  sync.token = v; sync.gist = null; syncSave();
  document.getElementById("syncToken").value = "";
  renderSync();
};
document.getElementById("syncPush").onclick = doSyncPush;
document.getElementById("syncPull").onclick = () => { closeSettings(); doSyncPull(); };
document.getElementById("menuSyncPush").onclick = () => { doSyncPush(); };
document.getElementById("menuSyncPull").onclick = () => { closeMenu(); doSyncPull(); };
document.getElementById("syncForget").onclick = () => {
  delete sync.token; delete sync.gist; delete sync.pushed; delete sync.pulled;
  syncSave(); renderSync("Токен удалён из этого браузера. Сама копия в GitHub осталась.");
};
document.getElementById("openSettings").addEventListener("click", () => renderSync());
renderSync();

/* ── установка как приложение ── */
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installEvt = e;
  document.getElementById("menuInstall").classList.remove("hidden");
});
window.addEventListener("appinstalled", () => {
  installEvt = null;
  document.getElementById("menuInstall").classList.add("hidden");
});
document.getElementById("menuInstall").onclick = () => {
  closeMenu();
  if(!installEvt) return;
  installEvt.prompt();
  installEvt.userChoice.finally(() => { installEvt = null; document.getElementById("menuInstall").classList.add("hidden"); });
};
if("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")){
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
