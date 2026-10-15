"use strict";
/* ── достижения ──
   Базы (data/*_achievements.json) собирает скрипт в GitHub Actions. Страница берёт их
   прямо из репозитория (raw.githubusercontent.com — там они свежие сразу после коммита
   бота), а если не вышло — из папки data рядом с сайтом. Последняя удачная загрузка
   хранится в IndexedDB, так что раздел открывается и без сети. Отметки — в localStorage. */
const ACH_KEY = "zzz-ach-v1";
const astore = makeStore(ACH_KEY);
let adata = astore.load() || {};
function aSave(){ astore.save(adata); }
const ACH_GAMES = [
  { id:"gi",  file:"genshin", name:"Genshin Impact",    short:"Genshin",   cur:"примогемов", hero:"Путешественник", who:"персонаж" },
  { id:"hsr", file:"hsr",     name:"Honkai: Star Rail", short:"Star Rail", cur:"нефрита",    hero:"Первопроходец",  who:"персонаж" },
  { id:"zzz", file:"zzz",     name:"Zenless Zone Zero", short:"ZZZ",       cur:"полихромов", hero:"Прокси",         who:"агент" }
];
const ACH_DIFF = { easy:"лёгкое", medium:"среднее", hard:"сложное" };
const ACH_DORD = { easy:1, medium:2, hard:3 };
const ACH_FLAGS = [
  { k:"set",        label:() => "Выбор одного из нескольких", test:a => a.set != null },
  { k:"gacha",      label:g => "Нужен " + g.who + " из баннера", test:a => !!a.gacha },
  { k:"missable",   label:() => "Можно упустить", test:a => !!a.missable },
  { k:"timegated",  label:() => "Растянуты во времени", test:a => !!a.timegated },
  { k:"impossible", label:() => "Сейчас недоступны", test:a => !!a.impossible },
  { k:"stages",     label:() => "Ступенчатые", test:a => (a.stages || 0) > 1 },
  { k:"hint",       label:() => "С подсказкой", test:a => !!a.hint }
];
const ACH_SORT_DIR = { game:1, version:-1, reward:-1, name:1, diff:-1, status:1 };
const ACH_TTL = 6 * 3600 * 1000;
// где лежат базы относительно корня репозитория (скрипт кладёт их в achievements/data)
const ACH_DIR = "achievements/data/";

const AS = (ui.ach && typeof ui.ach === "object") ? ui.ach : {};
ui.ach = AS;
if(!ACH_GAMES.some(g => g.id === AS.game)) AS.game = "gi";
AS.spoil = !!AS.spoil;
if(!AS.pg || typeof AS.pg !== "object") AS.pg = {};
// категория, версия и свёрнутые группы — у каждой игры свои
// поиск, фильтры, сортировка и группы — у каждой игры свои
function pf(gid){
  gid = gid || AS.game;
  let p = AS.pg[gid];
  if(!p || typeof p !== "object") p = AS.pg[gid] = {};
  if(!p._ok){
    ["series","ver","q","status","reward","diff","type"].forEach(k => { if(typeof p[k] !== "string") p[k] = ""; });
    if(!Array.isArray(p.flags)) p.flags = [];
    if(!Array.isArray(p.fold)) p.fold = [];
    // сортировку и группы берём из прежних общих настроек, если были
    if(!ACH_SORT_DIR[p.sort]) p.sort = ACH_SORT_DIR[AS.sort] ? AS.sort : "game";
    if(p.dir !== 1 && p.dir !== -1) p.dir = (AS.dir === 1 || AS.dir === -1) && p.sort === AS.sort ? AS.dir : ACH_SORT_DIR[p.sort];
    if(["none","series","version"].indexOf(p.group) === -1) p.group = ["none","series","version"].indexOf(AS.group) !== -1 ? AS.group : "series";
    Object.defineProperty(p, "_ok", { value:true, enumerable:false });
  }
  return p;
}

const adb = {};      // game → подготовленная база
const aErr = {};     // game → { msg, tried:[...] }
const aBusy = {};
const aInit = {};
let aLimit = 120;
const aOpenHint = new Set();
const aReveal = new Set();

function achGame(){ return ACH_GAMES.find(g => g.id === AS.game) || ACH_GAMES[0]; }
function achGameById(id){ return ACH_GAMES.find(g => g.id === id); }
function achNorm(s){ return String(s || "").toLowerCase().replace(/ё/g, "е"); }
function achVerKey(v){
  const m = /^(\d+)\.(\d+)/.exec(String(v || ""));
  return m ? +m[1] * 1000 + +m[2] : -1;
}
function achVerName(k){ return k < 0 ? "без версии" : Math.floor(k / 1000) + "." + (k % 1000); }
// в текстах игры остаются служебные вставки: род героя, ник, переносы строк
function achText(s, g){
  return String(s == null ? "" : s)
    .replace(/\\n/g, "\n")
    .replace(/\{M#([^}]*)\}\{F#([^}]*)\}/g, "$1/$2")
    .replace(/\{F#([^}]*)\}\{M#([^}]*)\}/g, "$2/$1")
    .replace(/\{[MF]#([^}]*)\}/g, "($1)")
    .replace(/\{NICKNAME\}/g, g.hero)
    .replace(/\{TEXTJOIN#\d+\}/g, "…")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/^#/, "")
    .trim();
}

function achCheck(doc, g){
  if(!doc || typeof doc !== "object" || !Array.isArray(doc.achievements)) return "это не база достижений";
  if(!doc.achievements.length) return "база пустая";
  if(doc.game && doc.game !== g.id) return "в файле база другой игры (" + doc.game + ")";
  return "";
}
function achPrep(doc, g){
  const ser = {};
  (Array.isArray(doc.series) ? doc.series : []).forEach((s, i) => {
    if(s && s.id != null) ser[s.id] = { id:s.id, name:achText(s.name, g) || ("Категория " + s.id), ord:i };
  });
  const list = doc.achievements.filter(a => a && a.id != null);
  const sets = {}, byId = {};
  list.forEach((a, i) => {
    a._o = i;
    a._n = achText(a.name, g) || ("#" + a.id);
    a._d = achText(a.description, g);
    a._v = String(a.version == null ? "" : a.version).trim();
    a._vk = achVerKey(a._v);
    a._s = " " + achClean(a._n + " " + a._d + " " + (a.hint || "") + " " + a.id) + " ";
    a._w = Array.from(new Set(a._s.split(" ").filter(w => w.length >= 2)));
    if(!ser[a.series_id]) ser[a.series_id] = { id:a.series_id, name:"Категория " + a.series_id, ord:1000 + i };
    if(a.set != null) (sets[a.set] = sets[a.set] || []).push(a);
    byId[a.id] = a;
  });
  return { doc, list, ser, sets, byId, src:"", at:0 };
}
function achSet(gid, doc, src, at, persist){
  const g = achGameById(gid);
  const db = achPrep(doc, g);
  db.src = src; db.at = at || Date.now();
  adb[gid] = db;
  if(persist){
    try { idbRun("readwrite", st => st.put({ doc, src, at:db.at }, "ach:" + gid)).catch(() => {}); } catch(e){}
  }
  return db;
}

function achSources(file){
  const name = file + "_achievements.json";
  const t = (ui.achSrc || "").trim();
  if(t){
    if(t.indexOf("{file}") !== -1) return [t.replace(/\{file\}/g, file)];
    const m = /^([\w.-]+)\/([\w.-]+)$/.exec(t);
    if(m) return ["https://raw.githubusercontent.com/" + m[1] + "/" + m[2] + "/HEAD/" + ACH_DIR + name];
    if(/\.json(\?|$)/i.test(t)) return [t];
    return [t.replace(/\/+$/, "") + "/" + name];
  }
  const out = [];
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
  if(m){
    const seg = location.pathname.split("/").filter(Boolean)[0];
    const repo = seg && !/\.html?$/i.test(seg) ? seg : m[1] + ".github.io";
    out.push("https://raw.githubusercontent.com/" + m[1] + "/" + repo + "/HEAD/" + ACH_DIR + name);
  }
  out.push(ACH_DIR + name);
  return out;
}

async function achFetch(g){
  if(aBusy[g.id]) return;
  aBusy[g.id] = true;
  delete aErr[g.id];
  if(ui.tab === "achievements") renderAch();
  const tried = [];
  let ok = false;
  for(const url of achSources(g.file)){
    let why = "";
    try {
      const r = await fetch(url, { cache:"no-cache" });
      if(!r.ok) why = r.status === 404 ? "файл не найден (404)" : "сервер ответил " + r.status;
      else {
        let doc = null;
        try { doc = await r.json(); } catch(e){ why = "файл не читается как JSON"; }
        if(doc){
          why = achCheck(doc, g);
          if(!why){ achSet(g.id, doc, url, Date.now(), true); ok = true; }
        }
      }
    } catch(e){
      why = location.protocol === "file:"
        ? "страница открыта как файл — браузер не даёт ей читать соседние файлы"
        : "адрес недоступен (нет сети или чтение запрещено)";
    }
    tried.push({ url, why });
    if(ok) break;
  }
  aBusy[g.id] = false;
  if(!ok) aErr[g.id] = { tried };
  if(ui.tab === "achievements") renderAch();
}
function achOpen(g, force){
  if(force){ achFetch(g); return; }
  if(aInit[g.id]) return;
  aInit[g.id] = true;
  let p;
  try { p = idbRun("readonly", st => st.get("ach:" + g.id)); } catch(e){ p = Promise.reject(e); }
  p.then(c => {
    if(c && c.doc && !achCheck(c.doc, g) && !adb[g.id]){
      achSet(g.id, c.doc, c.src || "кеш", c.at, false);
      if(ui.tab === "achievements") renderAch();
    }
    if(!c || !c.at || Date.now() - c.at > ACH_TTL) achFetch(g);
  }).catch(() => achFetch(g));
}

/* отметки */
function aDoneMap(gid){
  if(!adata[gid] || typeof adata[gid] !== "object") adata[gid] = {};
  return adata[gid];
}
function isDone(gid, a){ return !!(adata[gid] && adata[gid][a.id]); }
function aStatus(gid, db, a){
  if(isDone(gid, a)) return "done";
  if(a.impossible) return "blocked";
  if(a.set != null && db.sets[a.set].some(b => b !== a && isDone(gid, b))) return "blocked";
  return "todo";
}
function aMark(gid, db, a, on){
  const m = aDoneMap(gid);
  if(on){
    m[a.id] = Math.floor(Date.now() / 1000);
    // во взаимоисключающем наборе получить можно только одно
    if(a.set != null) db.sets[a.set].forEach(b => { if(b !== a) delete m[b.id]; });
  } else delete m[a.id];
}
// награда с учётом наборов: из набора засчитывается одно достижение
function achReward(gid, db, items){
  let got = 0, left = 0;
  const seen = {};
  items.forEach(a => {
    if(a.set != null){
      if(seen[a.set]) return;
      seen[a.set] = 1;
      const mem = db.sets[a.set];
      const d = mem.find(b => isDone(gid, b));
      if(d){ got += d.reward || 0; return; }
      const can = mem.filter(b => !b.impossible).map(b => b.reward || 0);
      if(can.length) left += Math.max.apply(null, can);
      return;
    }
    if(isDone(gid, a)) got += a.reward || 0;
    else if(!a.impossible) left += a.reward || 0;
  });
  return { got, left };
}

const ACH_MEDAL = { g:{ name:"золото", label:"Золотые" }, s:{ name:"серебро", label:"Серебряные" }, b:{ name:"бронза", label:"Бронзовые" } };
function achMedalKind(r){ r = +r || 0; return r >= 20 ? "g" : r >= 10 ? "s" : r > 0 ? "b" : "n"; }
function achMedal(r){
  const k = achMedalKind(r);
  return '<i class="medal ' + k + '"' + (ACH_MEDAL[k] ? ' title="' + ACH_MEDAL[k].name + '"' : "") + "></i>";
}

/* умный поиск: другая раскладка, окончания слов, опечатки */
const KB_EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./";
const KB_RU = "ёйцукенгшщзхъфывапролджэячсмитьбю.";
const KB_E2R = {}, KB_R2E = {};
for(let i = 0; i < KB_EN.length; i++){ KB_E2R[KB_EN[i]] = KB_RU[i]; KB_R2E[KB_RU[i]] = KB_EN[i]; }
Object.assign(KB_E2R, { "~":"ё", "{":"х", "}":"ъ", ":":"ж", '"':"э", "<":"б", ">":"ю" });
function kbConv(s, map){ let o = ""; for(const c of s) o += map[c] || c; return o; }
function achClean(s){ return achNorm(s).replace(/[^a-zа-я0-9]+/g, " "); }
const RU_END = ["иями","ями","ами","ого","его","ому","ему","ыми","ими","ией","ий","ый","ой","ая","яя","ое","ее","ые","ие","ых","их","ую","юю","ов","ев","ей","ам","ям","ах","ях","ом","ем","ью","а","я","о","е","ы","и","у","ю","ь","й"];
const EN_END = ["ing","ed","es","s"];
// основа слова без окончания: «диких» и «дикое» находят друг друга
function achStem(w){
  if(w.length < 4) return w;
  const ends = /[а-я]/.test(w) ? RU_END : /^[a-z]+$/.test(w) ? EN_END : [];
  for(const e of ends) if(w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
  return w;
}
function achEdit(a, b, max){
  if(Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = [];
  for(let j = 0; j <= b.length; j++) prev.push(j);
  for(let i = 1; i <= a.length; i++){
    const cur = [i];
    let low = i;
    for(let j = 1; j <= b.length; j++){
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if(prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if(v < low) low = v;
    }
    if(low > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
// слово похоже на начало какого-нибудь слова текста с 1–2 опечатками
function achFuzzy(q, words){
  const max = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if(!max) return false;
  for(const w of words){
    if(w.length < q.length - max) continue;
    for(let L = Math.max(1, q.length - max); L <= Math.min(w.length, q.length + max); L++)
      if(achEdit(q, w.slice(0, L), max) <= max) return true;
  }
  return false;
}
// разбор запроса: для каждого слова — как набрано, в другой раскладке и его основа.
// Другая раскладка берётся, только если набранное как есть ничего не находит.
function achQuery(q, list){
  const out = [];
  String(q || "").toLowerCase().split(/\s+/).filter(Boolean).forEach(t => {
    const clean = v => achNorm(v).replace(/[^a-zа-я0-9]+/g, "");
    const own = clean(t);
    const conv = [clean(kbConv(t, KB_E2R)), clean(kbConv(t, KB_R2E))].filter(v => v && v !== own);
    const needles = v => { const s = achStem(v); return s !== v && s.length >= 3 ? [v, s] : [v]; };
    let use = own ? needles(own) : [];
    let swapped = "";
    if(!use.length || !list.some(a => use.some(n => a._s.indexOf(n) !== -1))){
      const alt = conv.find(v => list.some(a => needles(v).some(n => a._s.indexOf(n) !== -1)));
      if(alt){ use = needles(alt); swapped = alt; }
    }
    if(!use.length && !conv.length) return;
    out.push({ needles:use, fuzzy:[own].concat(conv).filter(v => v && v.length >= 4), swapped });
  });
  return out;
}
let aSearch = { fuzzy:false, swapped:"", re:null };
function achSearch(items, q){
  aSearch = { fuzzy:false, swapped:"", re:null };
  const terms = achQuery(q, items);
  if(!terms.length) return q && q.trim() ? [] : items;
  const exact = items.filter(a => terms.every(t => t.needles.some(n => a._s.indexOf(n) !== -1)));
  aSearch.swapped = terms.filter(t => t.swapped).map(t => t.swapped).join(" ");
  if(exact.length){
    const all = [];
    terms.forEach(t => t.needles.forEach(n => { if(all.indexOf(n) === -1) all.push(n); }));
    all.sort((x, y) => y.length - x.length);
    const src = all.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/е/g, "[её]")).join("|");
    try { aSearch.re = new RegExp("(" + src + ")", "gi"); } catch(e){ aSearch.re = null; }
    return exact;
  }
  aSearch.fuzzy = true;
  return items.filter(a => terms.every(t =>
    t.needles.some(n => a._s.indexOf(n) !== -1) || t.fuzzy.some(f => achFuzzy(f, a._w))));
}
function achMark(text){
  const re = aSearch.re;
  if(!re || !text) return esc(text);
  return String(text).split(re).map((part, i) => i % 2 ? "<mark>" + esc(part) + "</mark>" : esc(part)).join("");
}

function achFiltered(db, gid){
  const p = pf();
  const flags = pf().flags.map(k => ACH_FLAGS.find(f => f.k === k)).filter(Boolean);
  const vMaj = /^(\d+)\.x$/.exec(p.ver);
  const out = db.list.filter(a => {
    if(p.series !== "" && String(a.series_id) !== p.series) return false;
    if(p.ver){
      if(p.ver === "none"){ if(a._vk >= 0) return false; }
      else if(vMaj){ if(a._vk < 0 || Math.floor(a._vk / 1000) !== +vMaj[1]) return false; }
      else if(achVerName(a._vk) !== p.ver) return false;
    }
    if(pf().status){
      const s = aStatus(gid, db, a);
      if(pf().status === "notdone" ? s === "done" : s !== pf().status) return false;
    }
    if(pf().reward && String(a.reward || 0) !== pf().reward) return false;
    if(pf().diff){
      if(pf().diff === "none" ? !!a.difficulty : a.difficulty !== pf().diff) return false;
    }
    if(pf().type === "hidden" && !a.hidden) return false;
    if(pf().type === "open" && a.hidden) return false;
    for(const f of flags) if(!f.test(a)) return false;
    return true;
  });
  return achSearch(out, p.q);
}
function achSorted(db, gid, arr){
  const byGame = (a, b) => (db.ser[a.series_id].ord - db.ser[b.series_id].ord) || (a._o - b._o);
  const SORD = { todo:0, blocked:1, done:2 };
  const prim = {
    game: byGame,
    version: (a, b) => a._vk - b._vk,
    reward: (a, b) => (a.reward || 0) - (b.reward || 0),
    name: (a, b) => a._n.localeCompare(b._n, "ru"),
    diff: (a, b) => (ACH_DORD[a.difficulty] || 0) - (ACH_DORD[b.difficulty] || 0),
    status: (a, b) => SORD[aStatus(gid, db, a)] - SORD[aStatus(gid, db, b)]
  }[pf().sort] || byGame;
  return arr.slice().sort((a, b) => (pf().dir * prim(a, b)) || byGame(a, b));
}
function achGroups(db, items){
  if(pf().group === "none") return [{ key:"", name:"", items }];
  const map = {}, out = [];
  items.forEach(a => {
    const k = pf().group === "series" ? "s:" + a.series_id : "v:" + a._vk;
    if(!map[k]){
      map[k] = pf().group === "series"
        ? { key:k, name:db.ser[a.series_id].name, ord:db.ser[a.series_id].ord, items:[] }
        : { key:k, name:a._vk < 0 ? "Без версии" : "Версия " + achVerName(a._vk), ord:a._vk, items:[] };
      out.push(map[k]);
    }
    map[k].items.push(a);
  });
  if(pf().group === "series") out.sort((x, y) => (pf().sort === "game" ? pf().dir : 1) * (x.ord - y.ord));
  else out.sort((x, y) => (pf().sort === "version" ? pf().dir : -1) * (x.ord - y.ord));
  return out;
}

function achOpt(value, text, cur){
  return '<option value="' + esc(value) + '"' + (value === cur ? " selected" : "") + ">" + esc(text) + "</option>";
}
function achFillSelects(db, g){
  const p = pf(), gid = g.id;
  // категории — в порядке игры, с прогрессом
  const sc = {};
  db.list.forEach(a => {
    const c = sc[a.series_id] || (sc[a.series_id] = { n:0, d:0 });
    c.n++; if(isDone(gid, a)) c.d++;
  });
  const sers = Object.keys(db.ser).map(k => db.ser[k]).filter(s => sc[s.id]).sort((x, y) => x.ord - y.ord);
  if(p.series && !sers.some(s => String(s.id) === p.series)) p.series = "";
  let h = achOpt("", "все категории (" + sers.length + ")", p.series);
  sers.forEach(s => { h += achOpt(String(s.id), s.name + " — " + sc[s.id].d + "/" + sc[s.id].n, p.series); });
  const fS = document.getElementById("fSeries");
  fS.innerHTML = h; fS.classList.toggle("set", !!p.series);

  // версии — по крупным номерам, новые сверху
  const vc = {}, mc = {};
  db.list.forEach(a => {
    vc[a._vk] = (vc[a._vk] || 0) + 1;
    if(a._vk >= 0){ const M = Math.floor(a._vk / 1000); mc[M] = (mc[M] || 0) + 1; }
  });
  const vks = Object.keys(vc).map(Number).filter(k => k >= 0).sort((x, y) => y - x);
  const valid = { "":1 };
  h = achOpt("", "все версии", p.ver);
  Object.keys(mc).map(Number).sort((x, y) => y - x).forEach(M => {
    h += '<optgroup label="Версии ' + M + '.x">';
    h += achOpt(M + ".x", "все " + M + ".x — " + mc[M], p.ver); valid[M + ".x"] = 1;
    vks.filter(k => Math.floor(k / 1000) === M).forEach(k => {
      const n = achVerName(k);
      h += achOpt(n, n + " — " + vc[k], p.ver); valid[n] = 1;
    });
    h += "</optgroup>";
  });
  if(vc[-1]){ h += achOpt("none", "без версии — " + vc[-1], p.ver); valid.none = 1; }
  if(!valid[p.ver]){ p.ver = ""; }
  const fV = document.getElementById("fVer");
  fV.innerHTML = h; fV.value = p.ver; fV.classList.toggle("set", !!p.ver);

  const rc = {};
  db.list.forEach(a => { const r = a.reward || 0; rc[r] = (rc[r] || 0) + 1; });
  const rs = Object.keys(rc).map(Number).sort((x, y) => x - y);
  if(pf().reward && !rc[pf().reward]) pf().reward = "";
  h = achOpt("", "любая", pf().reward);
  rs.forEach(r => { const md = ACH_MEDAL[achMedalKind(r)]; h += achOpt(String(r), (md ? md.name + " · " : "") + "+" + r + " — " + rc[r], pf().reward); });
  const fR = document.getElementById("fReward");
  fR.innerHTML = h; fR.classList.toggle("set", !!pf().reward);

  const dc = {};
  db.list.forEach(a => { const d = ACH_DIFF[a.difficulty] ? a.difficulty : "none"; dc[d] = (dc[d] || 0) + 1; });
  if(pf().diff && !dc[pf().diff]) pf().diff = "";
  h = achOpt("", "любая", pf().diff);
  ["easy","medium","hard"].forEach(d => { if(dc[d]) h += achOpt(d, ACH_DIFF[d] + " — " + dc[d], pf().diff); });
  if(dc.none) h += achOpt("none", "без оценки — " + dc.none, pf().diff);
  const fD = document.getElementById("fDiff");
  fD.innerHTML = h; fD.classList.toggle("set", !!pf().diff);

  const fSt = document.getElementById("fStatus");
  fSt.value = pf().status; fSt.classList.toggle("set", !!pf().status);
  const fT = document.getElementById("fType");
  fT.value = pf().type; fT.classList.toggle("set", !!pf().type);

  // особые признаки — показываем только те, что есть в базе этой игры
  const box = document.getElementById("fFlags");
  box.innerHTML = "";
  ACH_FLAGS.forEach(f => {
    const n = db.list.filter(f.test).length;
    if(!n){ return; }
    const b = document.createElement("button");
    b.className = "chip" + (pf().flags.indexOf(f.k) !== -1 ? " on" : "");
    b.innerHTML = esc(f.label(g)) + "<i>" + n + "</i>";
    b.onclick = () => {
      const i = pf().flags.indexOf(f.k);
      if(i === -1) pf().flags.push(f.k); else pf().flags.splice(i, 1);
      achChanged();
    };
    box.appendChild(b);
  });
  pf().flags = pf().flags.filter(k => ACH_FLAGS.some(f => f.k === k && db.list.some(f.test)));
}
function achFiltersActive(){
  const p = pf();
  return !!(pf().q || p.series || p.ver || pf().status || pf().reward || pf().diff || pf().type || pf().flags.length);
}
function achChanged(){
  aLimit = 120;
  saveUI();
  renderAch();
}

function achAgo(t){
  const m = Math.round((Date.now() - t) / 60000);
  if(m < 1) return "только что";
  if(m < 60) return m + " мин назад";
  const h = Math.round(m / 60);
  if(h < 48) return h + " ч назад";
  return Math.round(h / 24) + " дн назад";
}
function achHost(u){
  try { return /^https?:/.test(u) ? new URL(u).hostname : "папка " + ACH_DIR + " сайта"; } catch(e){ return u; }
}

function renderAch(){
  const g = achGame();
  achOpen(g);
  const db = adb[g.id];
  const gid = g.id;
  document.getElementById("hTitle").childNodes[0].nodeValue = "Достижения";

  const seg = document.getElementById("achGameSeg");
  seg.innerHTML = "";
  ACH_GAMES.forEach(x => {
    const b = document.createElement("button");
    b.className = x.id === gid ? "on" : "";
    b.textContent = x.short;
    b.onclick = () => { if(AS.game === x.id) return; AS.game = x.id; aLimit = 120; saveUI(); renderAch(); };
    seg.appendChild(b);
  });
  document.getElementById("achExport").disabled = !db;

  const state = document.getElementById("achState");
  const body = document.getElementById("achBody");
  if(!db){
    document.getElementById("hSub").textContent = g.name;
    body.classList.add("hidden");
    state.classList.remove("hidden");
    const err = aErr[gid];
    if(!err){
      state.innerHTML = "<b>Загружаю базу достижений…</b><p>" + esc(g.name) + "</p>";
      return;
    }
    let h = "<b>Базу достижений " + esc(g.name) + " загрузить не удалось</b>" +
      "<p>Её собирает скрипт в GitHub Actions и кладёт в папку <code>" + ACH_DIR + "</code> репозитория. Проверьте, что файл <code>" + ACH_DIR +
      esc(g.file) + "_achievements.json</code> там есть, или загрузите его сюда вручную.</p>";
    err.tried.forEach(t => { h += "<p><code>" + esc(t.url) + "</code> — " + esc(t.why) + "</p>"; });
    h += '<div class="row"><button class="mark sm" data-act="retry">Повторить</button><button class="ghost sm" data-act="file">Загрузить файл базы</button></div>';
    state.innerHTML = h;
    return;
  }
  state.classList.add("hidden");
  body.classList.remove("hidden");

  // итоги по всей игре
  const all = db.list;
  const done = all.filter(a => isDone(gid, a)).length;
  const rw = achReward(gid, db, all);
  const hid = all.filter(a => a.hidden), hidDone = hid.filter(a => isDone(gid, a)).length;
  const imp = all.filter(a => a.impossible && !isDone(gid, a)).length;
  const pct = all.length ? done / all.length * 100 : 0;
  document.getElementById("hSub").textContent = g.name + " · " + fmt(done) + " из " + fmt(all.length);
  document.getElementById("aDone").innerHTML = fmt(done) + "<small>/ " + fmt(all.length) + "</small>";
  document.getElementById("aBar").style.width = pct.toFixed(2) + "%";
  document.getElementById("aPct").textContent = (pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1)) + "%" +
    (imp ? " · сейчас недоступно: " + imp : "");
  const mc = { g:[0,0], s:[0,0], b:[0,0] };
  all.forEach(a => { const k = achMedalKind(a.reward); if(!mc[k]) return; mc[k][1]++; if(isDone(gid, a)) mc[k][0]++; });
  document.getElementById("aMedals").innerHTML = ["g","s","b"].filter(k => mc[k][1]).map(k =>
    '<span title="' + ACH_MEDAL[k].label + ' медали: получено ' + mc[k][0] + " из " + mc[k][1] + '">' + achMedal(k === "g" ? 20 : k === "s" ? 10 : 5) +
    "<b>" + fmt(mc[k][0]) + "</b><small>/ " + fmt(mc[k][1]) + "</small></span>").join("");
  document.getElementById("aGotK").textContent = "Получено " + g.cur;
  document.getElementById("aGot").innerHTML = fmt(rw.got) + "<small>/ " + fmt(rw.got + rw.left) + "</small>";
  document.getElementById("aLeft").textContent = fmt(rw.left);
  document.getElementById("aHid").innerHTML = fmt(hidDone) + "<small>/ " + fmt(hid.length) + "</small>";

  // откуда база и насколько свежая
  const d = db.doc.generated_at ? new Date(db.doc.generated_at) : null;
  const old = d && !isNaN(d) && Date.now() - d.getTime() > 14 * 864e5;
  let s = "База " + esc(db.doc.source || "") + (d && !isNaN(d) ? " от " + d.toLocaleDateString("ru-RU", { day:"numeric", month:"long", year:"numeric" }) : "") +
    " · " + fmt(all.length) + " шт. · " + esc(achHost(db.src)) + ", проверено " + achAgo(db.at) + " · ";
  s += aBusy[gid] ? "обновляю…" : '<button class="linkbtn" data-act="refresh">обновить</button>';
  if(old) s += '<br><span class="warn">База давно не обновлялась — проверьте, что автообновление в GitHub Actions работает.</span>';
  if(aErr[gid]) s += '<br><span class="warn">Обновить не вышло: ' + esc(aErr[gid].tried.map(t => t.why).join("; ")) + ". Показана сохранённая копия.</span>";
  document.getElementById("achSrcLine").innerHTML = s;

  document.getElementById("achQ").value = pf().q;
  achFillSelects(db, g);
  document.getElementById("aSort").value = pf().sort;
  const dir = document.getElementById("aDir");
  dir.textContent = pf().dir === 1 ? "↑" : "↓";
  dir.title = pf().dir === 1 ? "По возрастанию — нажмите, чтобы развернуть" : "По убыванию — нажмите, чтобы развернуть";
  dir.setAttribute("aria-label", dir.title);
  const gs = document.getElementById("aGroup");
  gs.innerHTML = "";
  [["none","нет"],["series","категории"],["version","версии"]].forEach(o => {
    const b = document.createElement("button");
    b.className = pf().group === o[0] ? "on" : "";
    b.textContent = o[1];
    b.onclick = () => { pf().group = o[0]; achChanged(); };
    gs.appendChild(b);
  });
  document.getElementById("aSpoil").classList.toggle("on", AS.spoil);
  document.getElementById("aReset").classList.toggle("hidden", !achFiltersActive());

  renderAchList(db, g);
  achTopCheck();
}

function achRowHtml(db, g, a){
  const gid = g.id;
  const st = aStatus(gid, db, a);
  const spoil = AS.spoil && a.hidden && st !== "done" && !aReveal.has(a.id);
  const m = [];
  if(pf().group !== "series") m.push('<button class="am" data-act="ser" title="Показать только эту категорию">' + esc(db.ser[a.series_id].name) + "</button>");
  if(pf().group !== "version") m.push('<button class="am" data-act="ver" title="Показать только эту версию">' + (a._vk < 0 ? "без версии" : "версия " + esc(a._v)) + "</button>");
  if(a.hidden) m.push('<span class="am hid">скрытое</span>');
  if(ACH_DIFF[a.difficulty]) m.push('<span class="am d-' + a.difficulty + '">' + ACH_DIFF[a.difficulty] + "</span>");
  if(a.stages > 1) m.push('<span class="am">ступень ' + (a.stage || 1) + " из " + a.stages + "</span>");
  if(a.set != null){
    const mem = db.sets[a.set];
    const other = mem.find(b => b !== a && isDone(gid, b));
    m.push('<span class="am set" title="Взаимоисключающие: награду дают только за одно из ' + mem.length + '. ' +
      esc(mem.filter(b => b !== a).map(b => b._n).join(" · ")) + '">' +
      (other ? "выбрано другое из " + mem.length : "одно из " + mem.length) + "</span>");
  }
  if(a.gacha) m.push('<span class="am">нужен ' + g.who + "</span>");
  if(a.missable) m.push('<span class="am warn">можно упустить</span>');
  if(a.timegated) m.push('<span class="am"' + (typeof a.timegated === "string" ? ' title="' + esc(a.timegated) + '"' : "") + ">растянуто во времени</span>");
  if(a.impossible) m.push('<span class="am warn">сейчас недоступно</span>');
  const ho = aOpenHint.has(a.id);
  if(a.hint) m.push('<button class="am hintbtn' + (ho ? " on" : "") + '" data-act="hint">подсказка' + (ho ? " ▴" : " ▾") + "</button>");
  const tip = st === "done" ? "Снять отметку" : "Отметить как полученное";
  return '<div class="arow' + (st === "done" ? " done" : st === "blocked" ? " blocked" : "") + '" data-id="' + esc(a.id) + '">' +
    '<button class="achk" data-act="tog" title="' + tip + '" aria-label="' + tip + ": " + esc(a._n) + '" aria-pressed="' + (st === "done") + '">' + (st === "done" ? "✓" : "") + "</button>" +
    '<div class="amain"><div class="an">' + achMark(a._n) + "</div>" +
    (a._d ? '<div class="ad' + (spoil ? ' spoil" data-act="spoil" title="Скрытое достижение — нажмите, чтобы прочитать' : "") + '">' + achMark(a._d) + "</div>" : "") +
    "</div>" +
    '<div class="ar">' + achMedal(a.reward) + '<span>+' + (a.reward || 0) + "</span></div>" +
    '<div class="ameta">' + m.join("") + "</div>" +
    (ho && a.hint ? '<div class="ahint">' + achMark(a.hint) + "</div>" : "") +
    "</div>";
}

function renderAchList(db, g){
  const gid = g.id;
  const items = achSorted(db, gid, achFiltered(db, gid));
  const rw = achReward(gid, db, items);
  const nd = items.filter(a => isDone(gid, a)).length;
  const canMark = items.some(a => aStatus(gid, db, a) === "todo");
  let sum = "<span>Показано <b>" + fmt(items.length) + "</b> из " + fmt(db.list.length) + " · получено <b>" + fmt(nd) + "</b></span>" +
    "<span>награда: <b class=\"g\">" + fmt(rw.got) + "</b> получено · ещё <b>" + fmt(rw.left) + "</b> " + g.cur + "</span>";
  if(achFiltersActive() && items.length){
    sum += '<span class="acts">' +
      (canMark ? '<button class="linkbtn" data-act="markall">отметить все показанные</button>' : "") +
      (nd ? '<button class="linkbtn" data-act="unmarkall">снять отметки с показанных</button>' : "") + "</span>";
  }
  document.getElementById("achSum").innerHTML = sum;
  const qn = document.getElementById("achQNote");
  const qs = [];
  if(pf().q.trim()){
    if(aSearch.swapped) qs.push("Искал в другой раскладке: <b>" + esc(aSearch.swapped) + "</b>");
    if(aSearch.fuzzy && items.length) qs.push("Точных совпадений нет — показаны похожие");
    qs.push(items.length ? "Найдено: " + fmt(items.length) : "Ничего не нашлось");
  }
  qn.innerHTML = qs.join(" · ");
  qn.classList.toggle("hidden", !qs.length);

  const list = document.getElementById("achList");
  if(!items.length){
    list.innerHTML = '<div class="achempty">' + (achFiltersActive() ? "Под эти фильтры ничего не подходит." : "В базе нет достижений.") + "</div>";
    document.getElementById("achMore").classList.add("hidden");
    return;
  }
  const fold = pf().fold;
  let html = "", shown = 0, more = 0;
  achGroups(db, items).forEach(gr => {
    if(shown >= aLimit){ if(fold.indexOf(gr.key) === -1) more += gr.items.length; return; }
    const isFold = gr.key && fold.indexOf(gr.key) !== -1;
    if(gr.key){
      const gd = gr.items.filter(a => isDone(gid, a)).length;
      const gl = achReward(gid, db, gr.items).left;
      html += '<button class="agroup' + (isFold ? "" : " open") + '" data-act="fold" data-k="' + esc(gr.key) + '" aria-expanded="' + !isFold + '">' +
        '<span class="caret">▸</span><span class="nm">' + esc(gr.name) + "</span>" +
        (gl ? '<span class="ct g">ещё +' + fmt(gl) + "</span>" : "") +
        '<span class="ct">' + gd + " / " + gr.items.length + "</span>" +
        '<span class="mini"><i style="width:' + (gd / gr.items.length * 100).toFixed(1) + '%"></i></span></button>';
    }
    if(isFold) return;
    gr.items.forEach(a => {
      if(shown >= aLimit){ more++; return; }
      html += achRowHtml(db, g, a);
      shown++;
    });
  });
  list.innerHTML = html;
  const mb = document.getElementById("achMore");
  mb.classList.toggle("hidden", !more);
  mb.textContent = "Показать ещё (" + fmt(more) + ")";
}

/* загрузка файла: база достижений или прогресс (UIAF и похожие списки) */
function achParseProgress(obj){
  let list = null;
  if(Array.isArray(obj)) list = obj;
  else if(obj && typeof obj === "object"){
    list = Array.isArray(obj.list) ? obj.list
      : Array.isArray(obj.achievements) ? obj.achievements
      : Array.isArray(obj.done) ? obj.done
      : Array.isArray(obj.data) ? obj.data : null;
    if(!list){
      const keys = Object.keys(obj).filter(k => /^\d+$/.test(k));
      if(keys.length) list = keys.filter(k => obj[k]).map(Number);
    }
  }
  const ids = [], ts = {};
  (list || []).forEach(x => {
    if(typeof x === "number" || (typeof x === "string" && /^\d+$/.test(x))){ ids.push(+x); return; }
    if(!x || typeof x !== "object" || x.id == null) return;
    const s = x.status;
    let ok;
    if(s == null) ok = x.done !== false && x.completed !== false && x.finished !== false;
    else if(typeof s === "number") ok = s >= 2;
    else if(typeof s === "boolean") ok = s;
    else ok = /FINISH|TAKEN|DONE|COMPLETE/i.test(String(s));
    if(!ok) return;
    ids.push(+x.id);
    const t = +x.timestamp || +x.time || 0;
    if(t) ts[+x.id] = t > 1e12 ? Math.floor(t / 1000) : t;
  });
  const hint = obj && !Array.isArray(obj) ? (obj.game || (obj.info && obj.info.game)) : null;
  return { ids, ts, hint, isList: !!list };
}
function achNote(msg){
  const el = document.getElementById("achSrcLine");
  const st = document.getElementById("achState");
  const host = el && !document.getElementById("achBody").classList.contains("hidden") ? el : st;
  if(!host) return;
  const p = document.createElement("span");
  p.className = "warn";
  p.style.display = "block";
  p.textContent = msg;
  host.appendChild(p);
}
function achLoadText(text){
  let obj;
  try { obj = JSON.parse(text); } catch(e){ achNote("Файл не читается как JSON."); return; }
  if(obj && Array.isArray(obj.achievements) && obj.achievements.length && obj.achievements[0] && obj.achievements[0].name != null){
    const g = achGameById(obj.game) || achGame();
    const err = achCheck(obj, g);
    if(err){ achNote("База не подошла: " + err + "."); return; }
    achSet(g.id, obj, "загружено из файла", Date.now(), true);
    delete aErr[g.id];
    setNav(g.id, "achievements");
    achNote("База " + g.name + " загружена из файла: " + fmt(obj.achievements.length) + " достижений.");
    return;
  }
  const pr = achParseProgress(obj);
  if(!pr.isList){ achNote("В файле нет ни базы достижений, ни списка полученных."); return; }
  // к какой игре относится прогресс — по совпадению номеров с загруженными базами
  let best = null, bestN = 0;
  ACH_GAMES.forEach(g => {
    const db = adb[g.id];
    if(!db) return;
    let n = pr.ids.filter(id => db.byId[id]).length;
    if(pr.hint === g.id) n += 0.5;
    if(n > bestN){ best = g; bestN = n; }
  });
  if(!best || bestN < 1){
    achNote(pr.ids.length ? "Номера достижений из файла не нашлись в загруженных базах. Откройте нужную игру, чтобы её база загрузилась, и повторите." : "В файле нет полученных достижений.");
    return;
  }
  const db = adb[best.id];
  const m = aDoneMap(best.id);
  let add = 0, had = 0, miss = 0;
  pr.ids.forEach(id => {
    const a = db.byId[id];
    if(!a){ miss++; return; }
    if(m[id]){ had++; return; }
    aMark(best.id, db, a, true);
    if(pr.ts[id]) m[id] = pr.ts[id];
    add++;
  });
  aSave();
  setNav(best.id, "achievements");
  achNote(best.name + ": отмечено новых " + add + ", уже было " + had + (miss ? ", нет в базе " + miss : "") + ".");
}
function achDownload(name, text){
  try {
    const blob = new Blob([text], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener"; a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
    return true;
  } catch(e){ return false; }
}

document.getElementById("achLoadBtn").onclick = () => document.getElementById("achFile").click();
document.getElementById("achFile").onchange = function(){
  const f = this.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = () => achLoadText(r.result);
  r.onerror = () => achNote("Файл не прочитался.");
  r.readAsText(f);
  this.value = "";
};
document.getElementById("achExport").onclick = () => {
  const g = achGame(), db = adb[g.id];
  if(!db) return;
  const m = aDoneMap(g.id);
  const ids = Object.keys(m).filter(id => db.byId[id]).map(Number).sort((x, y) => x - y);
  // формат UIAF: его понимают трекеры Genshin; для остальных игр — та же структура
  const out = {
    info:{ export_app:"Гача Трекер", export_app_version:"1", uiaf_version:"v1.1", export_timestamp:Math.floor(Date.now() / 1000), game:g.id },
    list: ids.map(id => ({ id, current:0, status:3, timestamp: typeof m[id] === "number" ? m[id] : 0 }))
  };
  if(!achDownload("achievements-" + g.file + "-" + todayKey + ".json", JSON.stringify(out, null, 1)))
    achNote("Скачивание заблокировано браузером.");
};
document.getElementById("achState").onclick = e => {
  const t = e.target.closest("[data-act]");
  if(!t) return;
  if(t.dataset.act === "retry") achOpen(achGame(), true);
  else if(t.dataset.act === "file") document.getElementById("achFile").click();
};
document.getElementById("achSrcLine").onclick = e => {
  const t = e.target.closest("[data-act]");
  if(t && t.dataset.act === "refresh") achOpen(achGame(), true);
};

let achQTimer = 0;
document.getElementById("achQ").oninput = function(){
  const v = this.value, gid = AS.game;
  clearTimeout(achQTimer);
  achQTimer = setTimeout(() => {
    pf(gid).q = v; aLimit = 120; saveUI();
    if(AS.game !== gid) return;
    const g = achGame(), db = adb[g.id];
    if(db){ renderAchList(db, g); document.getElementById("aReset").classList.toggle("hidden", !achFiltersActive()); }
  }, 140);
};
document.getElementById("fSeries").onchange = function(){ pf().series = this.value; achChanged(); };
document.getElementById("fVer").onchange = function(){ pf().ver = this.value; achChanged(); };
document.getElementById("fStatus").onchange = function(){ pf().status = this.value; achChanged(); };
document.getElementById("fReward").onchange = function(){ pf().reward = this.value; achChanged(); };
document.getElementById("fDiff").onchange = function(){ pf().diff = this.value; achChanged(); };
document.getElementById("fType").onchange = function(){ pf().type = this.value; achChanged(); };
document.getElementById("aSort").onchange = function(){ pf().sort = this.value; pf().dir = ACH_SORT_DIR[pf().sort] || 1; achChanged(); };
document.getElementById("aDir").onclick = () => { pf().dir = -pf().dir; achChanged(); };
document.getElementById("aSpoil").onclick = () => { AS.spoil = !AS.spoil; aReveal.clear(); achChanged(); };
document.getElementById("aReset").onclick = () => {
  const p = pf();
  pf().q = ""; p.series = ""; p.ver = ""; pf().status = ""; pf().reward = ""; pf().diff = ""; pf().type = ""; pf().flags = [];
  achChanged();
};
document.getElementById("achMore").onclick = () => {
  aLimit += 200;
  const g = achGame(), db = adb[g.id];
  if(db) renderAchList(db, g);
};
document.getElementById("achSum").onclick = e => {
  const t = e.target.closest("[data-act]");
  if(!t) return;
  const g = achGame(), db = adb[g.id];
  if(!db) return;
  const items = achFiltered(db, g.id);
  if(t.dataset.act === "markall"){
    const todo = items.filter(a => aStatus(g.id, db, a) === "todo");
    // из взаимоисключающего набора массово ничего не отмечаем — там нужен выбор
    const pick = todo.filter(a => a.set == null);
    const skip = todo.length - pick.length;
    askConfirm("Отметить показанные?",
      "Будет отмечено как полученные: " + pick.length + "." + (skip ? " Взаимоисключающие (" + skip + ") пропущены — их отметьте вручную." : ""),
      "Отметить " + pick.length,
      () => { pick.forEach(a => aMark(g.id, db, a, true)); aSave(); renderAch(); }, false);
  } else if(t.dataset.act === "unmarkall"){
    const dn = items.filter(a => isDone(g.id, a));
    askConfirm("Снять отметки?",
      "С " + dn.length + " показанных достижений будут сняты отметки о получении.",
      "Снять " + dn.length,
      () => { dn.forEach(a => aMark(g.id, db, a, false)); aSave(); renderAch(); }, false);
  }
};
document.getElementById("achList").onclick = e => {
  const t = e.target.closest("[data-act]");
  if(!t) return;
  const g = achGame(), db = adb[g.id];
  if(!db) return;
  const act = t.dataset.act;
  if(act === "fold"){
    const f = pf().fold, k = t.dataset.k, i = f.indexOf(k);
    if(i === -1) f.push(k); else f.splice(i, 1);
    saveUI();
    renderAchList(db, g);
    return;
  }
  const row = t.closest(".arow");
  const a = row && db.byId[row.dataset.id];
  if(!a) return;
  if(act === "tog"){
    aMark(g.id, db, a, !isDone(g.id, a));
    aSave();
    renderAch();
  } else if(act === "hint"){
    if(aOpenHint.has(a.id)) aOpenHint.delete(a.id); else aOpenHint.add(a.id);
    renderAchList(db, g);
  } else if(act === "spoil"){
    aReveal.add(a.id);
    t.classList.remove("spoil");
    t.removeAttribute("data-act");
    t.removeAttribute("title");
  } else if(act === "ser"){
    pf().series = String(a.series_id); achChanged();
    document.querySelector(".achfilters").scrollIntoView({ block:"nearest", behavior:"smooth" });
  } else if(act === "ver"){
    pf().ver = a._vk < 0 ? "none" : achVerName(a._vk); achChanged();
    document.querySelector(".achfilters").scrollIntoView({ block:"nearest", behavior:"smooth" });
  }
};
/* кнопка «наверх, к поиску» */
function achTopCheck(){
  const btn = document.getElementById("achTop");
  const q = document.getElementById("achQ");
  const on = ui.tab === "achievements" && !document.getElementById("achBody").classList.contains("hidden") &&
    q.getBoundingClientRect().bottom < 0;
  btn.classList.toggle("on", on);
}
window.addEventListener("scroll", achTopCheck, { passive:true });
window.addEventListener("resize", achTopCheck);
document.getElementById("achTop").onclick = () => {
  const q = document.getElementById("achQ");
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  q.closest(".achfilters").scrollIntoView({ block:"start", behavior: reduce ? "auto" : "smooth" });
  // на телефоне не открываем клавиатуру сами — только прокручиваем
  const touch = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  if(!touch) setTimeout(() => q.focus({ preventScroll:true }), reduce ? 0 : 350);
};

document.getElementById("achSrc").onchange = function(){
  ui.achSrc = this.value.trim();
  saveUI();
  Object.keys(aInit).forEach(k => delete aInit[k]);
  Object.keys(aErr).forEach(k => delete aErr[k]);
  if(ui.tab === "achievements") achOpen(achGame(), true);
};
document.getElementById("openSettings").addEventListener("click", () => {
  document.getElementById("achSrc").value = ui.achSrc || "";
});
