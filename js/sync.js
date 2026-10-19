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
const GIST_DESC = "PityReon — резервная копия";
if(typeof sync.auto !== "boolean") sync.auto = true;
// метка этого браузера: пишется в копию, чтобы своё же сохранение не считалось «новее»
if(!sync.dev){ sync.dev = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sstore.save(sync); }
const SYNC_EVERY = 5 * 60 * 1000;
function syncSave(){ sstore.save(sync); }
// быстрый отпечаток данных: по нему видно, менялось ли что-то с последней синхронизации
function textHash(s){
  let h = 0x811c9dc5;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + ":" + s.length;
}
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
/* Защита от перезаписи: если копию в GitHub с тех пор, как это устройство видело её
   в последний раз, обновило другое устройство, без явного согласия не отправляем. */
function remoteDev(g){ const m = g && /· dev:([a-z0-9]+)/.exec(g.description || ""); return m ? m[1] : ""; }
function newerRemote(g){
  // другая вкладка этого же браузера могла отправить копию — берём свежие отметки из хранилища
  const st = sstore.load() || {};
  if(st.remoteAt && (!sync.remoteAt || st.remoteAt > sync.remoteAt)){ sync.remoteAt = st.remoteAt; sync.hash = st.hash; sync.gist = st.gist || sync.gist; }
  if(!g || (sync.remoteAt && g.updated_at <= sync.remoteAt)) return false;
  // копию отправил этот же браузер — это не чужое сохранение, просто запоминаем время
  if(remoteDev(g) === sync.dev){ sync.remoteAt = g.updated_at; syncSave(); return false; }
  return true;
}
async function syncPush(force){
  const text = backupText();
  const files = {}; files[GIST_FILE] = { content: text };
  const desc = GIST_DESC + " · dev:" + sync.dev;
  const body = JSON.stringify({ description: desc, files });
  const g = await findGist();
  if(!force && newerRemote(g)){
    const e = new Error("в GitHub копия новее — её отправило другое устройство");
    e.status = "conflict"; e.updated = g.updated_at;
    throw e;
  }
  const res = g
    ? await gh("/gists/" + g.id, { method:"PATCH", body })
    : await gh("/gists", { method:"POST", body: JSON.stringify({ description: desc, public:false, files }) });
  sync.gist = res.id;
  sync.pushed = Date.now();
  sync.remoteAt = res.updated_at;
  sync.hash = textHash(text);
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
  document.getElementById("syncAuto").checked = !!sync.auto;
  st.textContent = msg || (on
    ? "Токен сохранён в этом браузере." + (sync.pushed ? " Последняя отправка с этого устройства: " + syncWhen(sync.pushed) + "." : "") +
      (sync.pulled ? " Последняя загрузка: " + syncWhen(sync.pulled) + "." : "") +
      (sync.auto ? (syncPaused ? " Автоотправка на паузе: в GitHub копия новее." : " Изменения отправляются сами раз в 5 минут.") : "")
    : "Не настроено.");
}
let syncBusy = false, syncPaused = false;
async function doSyncPush(force){
  if(syncBusy) return;
  syncBusy = true; renderSync("Отправляю…");
  try {
    await syncPush(force === true);
    syncPaused = false; hideSyncBar();
    renderSync("Отправлено " + syncWhen(sync.pushed) + "."); note("Копия отправлена в GitHub.");
  } catch(e){
    if(e.status === "conflict"){
      syncBusy = false; renderSync();
      askConfirm("В GitHub копия новее",
        "Её отправило другое устройство " + syncWhen(e.updated) + ". Если отправить отсюда, она заменится данными этого устройства. " +
        "Обычно правильнее сначала загрузить её.",
        "Всё равно отправить", () => doSyncPush(true), false);
      return;
    }
    renderSync("Не отправлено: " + e.message + ".", true); note("Не отправлено: " + e.message + ".");
  }
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
        sync.pulled = Date.now();
        sync.remoteAt = got.updated;
        // после объединения календаря и достижений данные могут отличаться от копии —
        // тогда автоотправка выгрузит объединённый вариант
        sync.hash = textHash(got.text);
        syncPaused = false; hideSyncBar();
        syncSave();
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
  checkRemote();
};
document.getElementById("syncPush").onclick = () => doSyncPush();
document.getElementById("syncAuto").onchange = function(){ sync.auto = this.checked; syncSave(); renderSync(); };
document.getElementById("syncPull").onclick = () => { closeSettings(); doSyncPull(); };
document.getElementById("menuSyncPush").onclick = () => { closeMenu(); doSyncPush(); };
document.getElementById("menuSyncPull").onclick = () => { closeMenu(); doSyncPull(); };
document.getElementById("syncForget").onclick = () => {
  delete sync.token; delete sync.gist; delete sync.pushed; delete sync.pulled;
  syncSave(); renderSync("Токен удалён из этого браузера. Сама копия в GitHub осталась.");
};
document.getElementById("openSettings").addEventListener("click", () => renderSync());

/* плашка «в GitHub копия новее» */
function showSyncBar(updated){
  document.getElementById("syncBarText").textContent =
    "В GitHub копия новее · " + new Date(updated).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
  document.getElementById("syncBar").classList.remove("hidden");
}
function hideSyncBar(){ document.getElementById("syncBar").classList.add("hidden"); }
document.getElementById("syncBarPull").onclick = () => { hideSyncBar(); doSyncPull(); };
document.getElementById("syncBarClose").onclick = hideSyncBar;

/* автоотправка: раз в 5 минут и при уходе со страницы — только если данные изменились */
async function autoSync(){
  if(!sync.token || !sync.auto || syncBusy || syncPaused) return;
  if(textHash(backupText()) === sync.hash) return;
  syncBusy = true;
  try { await syncPush(false); renderSync(); }
  catch(e){
    if(e.status === "conflict"){ syncPaused = true; showSyncBar(e.updated); }
    renderSync(e.status === "conflict" ? null : "Автоотправка не удалась: " + e.message + ".", e.status !== "conflict");
  }
  syncBusy = false;
}
// при открытии смотрим, не обновило ли копию другое устройство
async function checkRemote(){
  if(!sync.token) return;
  try {
    const g = await findGist();
    if(newerRemote(g)){ syncPaused = true; showSyncBar(g.updated_at); renderSync(); }
  } catch(e){}
}
setInterval(autoSync, SYNC_EVERY);
document.addEventListener("visibilitychange", () => {
  if(document.hidden) autoSync();
  else if(sync.token && Date.now() - (sync.checked || 0) > SYNC_EVERY){ sync.checked = Date.now(); checkRemote(); }
});
setTimeout(() => { sync.checked = Date.now(); checkRemote(); }, 1500);
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
