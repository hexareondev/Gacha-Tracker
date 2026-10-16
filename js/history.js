"use strict";
/* ══ раздел «История»: импорт UIGF v4 ══ */
const HKEY = "zzz-gacha-v1";
const hstore = makeStore(HKEY);
let hdata = hstore.load();
if(!hdata || !hdata.accounts) hdata = { accounts: [], active: null };
let histBanner = null, histPage = 0;

const GAMES = {
  hk4e:  { name:"Genshin Impact",    top:"5", mid:"4", topName:"пятизвёздочных",
    banners:{
      "301":{ n:"Ивентовый",        s:"персонажи",        pity:90, pool:"limited", ord:1 },
      "302":{ n:"Оружейный",        s:"оружие",           pity:80, pool:"limited", ord:2 },
      "500":{ n:"Хроники",          s:"смешанный",        pity:90, ord:3 },
      "200":{ n:"Стандартный",      s:"постоянный",       pity:90, pool:"standard", ord:4 },
      "100":{ n:"Новичковый",       s:"для начинающих",   pity:20, ord:5 }
    }},
  hkrpg: { name:"Honkai: Star Rail", top:"5", mid:"4", topName:"пятизвёздочных",
    banners:{
      "11":{ n:"Ивентовый",         s:"персонажи",        pity:90, pool:"limited", ord:1 },
      "12":{ n:"Световые конусы",   s:"оружие",           pity:80, pool:"limited", ord:2 },
      "21":{ n:"Коллаборация",      s:"персонажи",        pity:90, pool:"limited", ord:3 },
      "22":{ n:"Коллаб-конусы",     s:"оружие",           pity:80, pool:"limited", ord:4 },
      "1": { n:"Стандартный",       s:"постоянный",       pity:90, pool:"standard", ord:5 },
      "2": { n:"Новичковый",        s:"для начинающих",   pity:50, ord:6 }
    }},
  nap:   { name:"Zenless Zone Zero", top:"4", mid:"3", topName:"S-ранга",
    banners:{
      "2":{ n:"Эксклюзивный",       s:"агенты",           pity:90, pool:"limited", ord:1 },
      "3":{ n:"Амплификаторы",       s:"оружие",           pity:80, pool:"limited", ord:2 },
      "102":{ n:"Повтор: агенты",   s:"агент на выбор",   pity:90, ord:3 },
      "103":{ n:"Повтор: амплификаторы", s:"амплификатор на выбор", pity:80, ord:4 },
      "5":{ n:"Банбу",              s:"бангбу",           pity:80, pool:"limited", ord:5 },
      "1":{ n:"Стандартный",        s:"постоянный",       pity:90, pool:"standard", ord:6 }
    }}
};
function gameInfo(g){ return GAMES[g] || { name:g, top:"5", mid:"4", topName:"редких", banners:{} }; }
function bannerInfo(g, k){
  const b = gameInfo(g).banners[k];
  return b || { n:"Канал " + k, s:"неизвестный тип", pity:90, ord:99 };
}
const TYPE_RU = {
  "character":"Персонаж", "characters":"Персонаж", "персонаж":"Персонаж", "персонажи":"Персонаж",
  "角色":"Персонаж", "キャラクター":"Персонаж",
  "weapon":"Оружие", "weapons":"Оружие", "оружие":"Оружие", "武器":"Оружие",
  "light cone":"Световой конус", "light cones":"Световой конус",
  "световой конус":"Световой конус", "световые конусы":"Световой конус", "光锥":"Световой конус", "光錐":"Световой конус",
  "agent":"Агент", "agents":"Агент", "агент":"Агент", "агенты":"Агент", "代理人":"Агент", "エージェント":"Агент",
  "w-engine":"Амплификатор", "w-engines":"Амплификатор",
  "амплификатор":"Амплификатор", "амплификаторы":"Амплификатор", "音擎":"Амплификатор",
  "bangboo":"Банбу", "bangboos":"Банбу", "банбу":"Банбу", "бангбу":"Банбу", "邦布":"Банбу"
};
function typeRu(raw, fallback){
  if(!raw) return fallback || "—";
  return TYPE_RU[String(raw).trim().toLowerCase()] || raw;
}
function itemKey(r){ return r.i || r.n; }
function runKey(r){
  const g = r.g;
  return (g && g !== "0" && g !== r.k) ? g : "";
}
/* gacha_id считаем прогоном баннера только если он реально различается внутри канала:
   некоторые выгрузки его не пишут вовсе или подставляют туда номер канала. */
const runsCache = {};   // вне данных аккаунта: иначе кеш переживёт новый импорт
function runsUsable(acc){
  const ck = acc.key + ":" + acc.records.length;
  if(runsCache[ck] !== undefined) return runsCache[ck];
  const seen = {};
  acc.records.forEach(r => {
    const g = runKey(r);
    if(!g) return;
    (seen[r.k] = seen[r.k] || {})[g] = 1;
  });
  runsCache[ck] = Object.keys(seen).some(k => Object.keys(seen[k]).length > 1);
  return runsCache[ck];
}

/* Отметка означает «этот персонаж разыгрывался в этом прогоне», а не «это выпадение —
   победа». Поэтому при догрузке старых круток, когда перед ним появляется проигрыш,
   выпадение само становится гарантом, но знание о разыгрываемом сохраняется — и
   остальные выпадения того же прогона по-прежнему считаются проигрышами. */
function featStatus(acc, run, key, id){
  if((acc.featId || {})[id]) return true;
  const f = acc.feat || {}, nf = acc.notfeat || {};
  if(run && f[run]) return f[run] === key;
  if(run && nf[run] && nf[run][key]) return false;
  return null;
}
function savedMark(acc, x){
  if((acc.featId || {})[x.rec.id]) return "win";
  if((acc.fifty || {})[x.rec.id] === "lose") return "lose";
  return "none";
}
function nextMark(acc, x){
  const cur = savedMark(acc, x);
  return cur === "win" ? "lose" : cur === "lose" ? "none" : "win";
}

function resolveTops(acc, b){
  const ov = acc.fifty || {};
  const useRuns = runsUsable(acc);
  const mode = markMode(acc);
  const pool = mode === "std" && (STD_ELIGIBLE[acc.game] || {})[b.k] ? stdPool(acc.game) : null;
  // у баннеров со своим пулом (банбу) стандарт не поможет — там как «неразмеченные: выигрыш»
  const optimistic = mode === "win" || (mode === "std" && !pool);
  let guaranteed = false;
  return b.tops.map(x => {
    const run = useRuns ? runKey(x.rec) : "";
    const key = itemKey(x.rec);
    const mark = savedMark(acc, x);
    const feat = featStatus(acc, run, key, x.rec.id);
    let st, auto = false, src = "";
    if(mark === "lose") st = "lose";
    else if(guaranteed){ st = "guard"; auto = mark !== "win"; }   // гарант перебивает всё
    else if(feat === true) st = "win";
    else if(feat === false){ st = "lose"; auto = true; }
    else if(pool){ st = isStdAt(acc.game, x.rec, pool) ? "lose" : "win"; auto = true; src = "std"; }
    else if(optimistic){ st = "win"; auto = true; src = "def"; }
    else st = "none";
    guaranteed = st === "lose";
    return { rec:x.rec, pulls:x.pulls, st:st, run:run, key:key, auto:auto, src:src,
      featured: feat === true, fixed: mark !== "none" };
  });
}

function markTop(acc, x, st){
  acc.fifty = acc.fifty || {};
  acc.featId = acc.featId || {};
  acc.feat = acc.feat || {};
  acc.notfeat = acc.notfeat || {};
  const run = x.run;
  if(st === "win"){
    acc.featId[x.rec.id] = 1;
    delete acc.fifty[x.rec.id];
    if(run){
      acc.feat[run] = x.key;                        // разыгрываемый этого прогона
      if(acc.notfeat[run]) delete acc.notfeat[run][x.key];
      const g = gameInfo(acc.game);
      acc.records.forEach(r => {                    // в прогоне разыгрываемый один
        if(r.r === g.top && runKey(r) === run && itemKey(r) !== x.key) delete acc.featId[r.id];
      });
    }
  } else if(st === "lose"){
    acc.fifty[x.rec.id] = "lose";
    delete acc.featId[x.rec.id];
    if(run){
      acc.notfeat[run] = acc.notfeat[run] || {};
      acc.notfeat[run][x.key] = 1;
      if(acc.feat[run] === x.key) delete acc.feat[run];
    }
  } else {
    delete acc.featId[x.rec.id];
    delete acc.fifty[x.rec.id];
    if(run){
      if(acc.feat[run] === x.key) delete acc.feat[run];
      if(acc.notfeat[run]) delete acc.notfeat[run][x.key];
    }
  }
  hSave();
}
function fiftyStats(tops){
  const play = tops.filter(x => x.st === "win" || x.st === "lose");
  let win = 0, curW = 0, curL = 0, bestW = 0, bestL = 0, cur = 0, curKind = "";
  play.forEach(x => {
    if(x.st === "win"){ win++; curW++; curL = 0; bestW = Math.max(bestW, curW); }
    else { curL++; curW = 0; bestL = Math.max(bestL, curL); }
  });
  for(let i = play.length - 1; i >= 0; i--){
    if(!curKind) curKind = play[i].st;
    if(play[i].st !== curKind) break;
    cur++;
  }
  return { played:play.length, win:win, rate: play.length ? win / play.length * 100 : 0,
    cur:cur, kind:curKind, bestW:bestW, bestL:bestL,
    unmarked: tops.filter(x => x.st === "none").length };
}
/* ── портреты ──
   Прямые шаблоны URL у открытых баз разные и меняются, поэтому основной путь другой:
   приложение подтягивает индексный JSON базы (id предмета → имя файла иконки) и строит
   адрес по нему. Шаблоны остаются запасным вариантом. Если ничего не нашлось, портрет
   просто не показывается. */
const ICON_TPL = {
  // Star Rail: имя файла совпадает с кодом предмета, справочник не нужен
  hkrpg: {
    // круглый портрет лучше смотрится в кружке, чем полная карточка персонажа
    char: ["https://enka.network/ui/hsr/SpriteOutput/AvatarRoundIcon/{id}.png",
           "https://static.nanoka.cc/assets/hsr/avatariconround/{id}.webp",
           "https://static.nanoka.cc/assets/hsr/avatarshopicon/{id}.webp"],
    item: ["https://static.nanoka.cc/assets/hsr/lightconemediumicon/{id}.webp",
           "https://enka.network/ui/hsr/SpriteOutput/LightConeMediumIcon/{id}.png",
           "https://enka.network/ui/hsr/SpriteOutput/ItemIcon/{id}.png"]
  },
  // ZZZ и Genshin: имя файла с кодом не связано, нужен справочник
  nap:  { char: [], item: [] },
  hk4e: { char: [], item: [] }
};
/* Справочники: код предмета → имя файла иконки.
   Файлы с raw.githubusercontent.com читаются из браузера без ограничений,
   поэтому они идут первыми. */
const ICON_IDX = {
  nap: {
    char: ["https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/avatars.json",
           "https://api.hakush.in/zzz/data/character.json"],
    // справочники перечитываются по сроку, иначе новые персонажи остаются без портрета
    item: ["https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/weapons.json",
           "https://api.hakush.in/zzz/data/weapon.json",
           "https://api.hakush.in/zzz/data/bangboo.json"]
  },
  hk4e: {
    char: ["https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json",
           "https://gi.yatta.moe/api/v2/en/avatar",
           "https://api.hakush.in/gi/data/character.json"],
    item: ["https://gi.yatta.moe/api/v2/en/weapon",
           "https://api.hakush.in/gi/data/weapon.json",
           "https://api.ambr.top/v2/en/weapon"]
  },
  hkrpg: { char: [], item: [] }
};
const UI_BASE = {
  hkrpg: "https://static.nanoka.cc/assets/hsr/",
  nap:   "https://static.nanoka.cc/assets/zzz/",
  hk4e:  "https://static.nanoka.cc/assets/gi/"
};
const ENKA_HOST = "https://enka.network";
/* Версия набора источников. Меняется вместе со списками выше — тогда сохранённые
   справочники и подобранные адреса сбрасываются, иначе старый пустой справочник
   навсегда блокировал бы новые попытки. */
const ICON_SRC_VER = 6;
(function resetIconCacheOnUpgrade(){
  if(ui.iconVer === ICON_SRC_VER) return;
  ui.iconVer = ICON_SRC_VER;
  ui.iconIdx = {};
  ui.iconPick = {};
  ui.iconOk = {};
  saveUI();
})();
const LOCAL_TPL = "assets/{game}/{id}.webp";
function iconMode(){ return ui.iconMode || "auto"; }
function iconKind(r){
  const t = String(r.y || "").toLowerCase();
  return /персонаж|character|агент|agent/.test(t) ? "char" : "item";
}

/* вытаскиваем имя файла иконки из записи индекса, не завязываясь на конкретное поле */
const ICON_FIELDS = ["CircleIcon","ImagePath","Image","Icon","icon","image","iconPath","SideIconName"];
function pickIconField(v){
  if(typeof v === "string") return v;
  if(!v || typeof v !== "object") return "";
  for(let i = 0; i < ICON_FIELDS.length; i++){
    const val = v[ICON_FIELDS[i]];
    if(typeof val === "string" && val) return val;
  }
  let best = "";
  Object.keys(v).forEach(k => {
    const val = v[k];
    if(typeof val !== "string" || best) return;
    if(/icon|image/i.test(k) || /(Icon|SpriteOutput|\/ui\/)/i.test(val)) best = val;
  });
  return best;
}
// значение сохраняем как есть: бывает и короткое имя, и путь вида /ui/zzz/IconRoleCircle01.png
function iconNameFrom(v){ return pickIconField(v) || ""; }
function buildIndex(json){
  const out = {};
  const put = (id, val) => {
    const nm = iconNameFrom(val);
    if(id && /^\d+$/.test(String(id)) && nm) out[String(id)] = nm;
  };
  const walk = (obj, depth) => {
    if(!obj || typeof obj !== "object" || depth > 2) return;
    if(Array.isArray(obj)){ obj.forEach(v => put(v && (v.id || v.Id || v.itemId), v)); return; }
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if(/^\d+$/.test(k)) put(k, v);
      else walk(v, depth + 1);      // бывает обёртка вроде { "Items": { ... } }
    });
  };
  walk(json, 0);
  return out;
}
let idxLoading = {};
const IDX_TTL = 3 * 24 * 3600 * 1000;    // справочник живёт трое суток
const idxRefreshed = {};                 // принудительные обновления этой сессии
const iconMiss = {};        // в памяти, а не в настройках: после перезагрузки пробуем снова
const idxFailed = {};       // справочники, которые не удалось получить в этой сессии
function listSig(list){
  let s = list.length + ":";
  const j = list.join("|");
  let n = 0;
  for(let i = 0; i < j.length; i++) n = (n * 31 + j.charCodeAt(i)) >>> 0;
  return s + n.toString(36);
}
function ensureIndex(game, kind, done, force){
  if(iconMode() !== "auto") return;
  ui.iconIdx = ui.iconIdx || {};
  ui.iconIdxAt = ui.iconIdxAt || {};
  const slot = game + ":" + kind;
  if(idxLoading[slot]) return;
  const have = ui.iconIdx[slot];
  const stale = have && (Date.now() - (ui.iconIdxAt[slot] || 0) > IDX_TTL);
  if(have && !stale && !force) return;
  if(force){
    if(idxRefreshed[slot]) return;       // не больше одного обновления на слот за сессию
    idxRefreshed[slot] = 1;
  }
  if(idxFailed[slot]) return;
  const urls = (ICON_IDX[game] || {})[kind] || [];
  if(!urls.length || typeof fetch !== "function"){
    idxFailed[slot] = 1;          // справочник не предусмотрен: адреса строятся по коду
    return;
  }
  idxLoading[slot] = 1;
  let i = 0, acc = {};
  const step = () => {
    if(i >= urls.length){
      delete idxLoading[slot];
      if(Object.keys(acc).length){
        const before = Object.keys(ui.iconIdx[slot] || {}).length;
        ui.iconIdx[slot] = acc;
        ui.iconIdxAt[slot] = Date.now();
        saveUI();
        if(done && Object.keys(acc).length !== before) done();
      } else {
        idxFailed[slot] = 1;      // пусто — в этой сессии не повторяем, после перезагрузки пробуем снова
      }
      return;
    }
    fetch(urls[i], { cache: "force-cache" })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if(j) Object.assign(acc, buildIndex(j)); })
      .catch(() => {})
      .then(() => { i++; step(); });
  };
  step();
}
function indexUrls(game, r){
  const slot = game + ":" + iconKind(r);
  const map = (ui.iconIdx || {})[slot];
  const nm = map && map[String(r.i)];
  if(!nm) return [];
  const base = UI_BASE[game] || "";
  const bare = nm.split("/").pop().replace(/\.(png|webp|jpg)$/i, "");
  const out = [];
  if(nm.charAt(0) === "/") out.push(ENKA_HOST + nm);      // путь Enka уже с расширением
  if(game === "hk4e"){
    // в справочнике Genshin лежит боковая иконка — обычная называется без «_Side»
    const front = bare.replace("UI_AvatarIcon_Side_", "UI_AvatarIcon_");
    if(front !== bare) out.push(ENKA_HOST + "/ui/" + front + ".png");
    out.push(ENKA_HOST + "/ui/" + bare + ".png");
  }
  out.push(base + bare + ".webp", base + bare + ".png");
  return out.filter((u, i) => out.indexOf(u) === i);
}

function iconList(game, r){
  const mode = iconMode();
  if(mode === "off") return [];
  const kind = iconKind(r);
  const own = kind === "char" ? (ui.iconTpl || LOCAL_TPL) : (ui.iconTplItem || ui.iconTpl || LOCAL_TPL);
  if(mode === "local" || mode === "custom") return [own];
  const set = ICON_TPL[game] || {};
  const all = [own].concat(indexUrls(game, r)).concat(set[kind] || []);
  return all.filter((u, i) => u && all.indexOf(u) === i);   // без повторов
}

function attachIcon(td, game, r){
  if(!td || !r.i) return;
  const kind = iconKind(r), slot0 = game + ":" + kind;
  const known = (ui.iconIdx || {})[slot0];
  // код неизвестен справочнику — скорее всего персонаж новее, чем наша копия
  const needFresh = !!known && !known[String(r.i)];
  ensureIndex(game, kind, () => {
    if(document.body.classList.contains("tab-history")) renderHistory();
  }, needFresh);
  const list = iconList(game, r);
  if(!list.length) return;
  ui.iconPick = ui.iconPick || {};
  const slot = slot0;
  // промах привязан к составу адресов: появился справочник или сменился шаблон — пробуем заново
  const missKey = slot + ":" + r.i + ":" + listSig(list);
  if(iconMiss[missKey]) return;
  const idxReady = (!!(ui.iconIdx || {})[slot] || !!idxFailed[slot]) && !idxLoading[slot];
  const start = typeof ui.iconPick[slot] === "number" ? ui.iconPick[slot] : 0;
  const order = list.slice(start).concat(list.slice(0, start));
  const fill = t => t.replace(/\{id\}/g, r.i).replace(/\{game\}/g, game);
  let i = 0;
  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.onload = () => {
    const idx = list.indexOf(order[i]);
    if(idx >= 0 && ui.iconPick[slot] !== idx){ ui.iconPick[slot] = idx; saveUI(); }
    ui.iconOk = ui.iconOk || {};
    if(ui.iconOk[slot] !== order[i]){ ui.iconOk[slot] = order[i]; saveUI(); }
  };
  img.onerror = () => {
    i++;
    if(i < order.length){ img.src = fill(order[i]); return; }
    img.remove();
    // пока справочник не пришёл, промах не запоминаем — адреса ещё изменятся
    if(idxReady) iconMiss[missKey] = 1;
  };
  img.src = fill(order[0]);
  td.appendChild(img);
}

function hSave(){ hstore.save(hdata); }
function HA(){
  const gk = typeof histGameKey === "function" ? histGameKey() : null;
  const list = gk ? hdata.accounts.filter(a => a.game === gk) : hdata.accounts;
  return list.find(a => a.key === hdata.active) || list[0] || null;
}
// прежние версии хранили "win" как статус выпадения — переносим в пометку разыгрываемого
(function migrateMarks(){
  let touched = false;
  (hdata.accounts || []).forEach(acc => {
    const ov = acc.fifty;
    if(!ov) return;
    Object.keys(ov).forEach(id => {
      if(ov[id] !== "win" && ov[id] !== "guard") return;
      if(ov[id] === "win"){ acc.featId = acc.featId || {}; acc.featId[id] = 1; }
      delete ov[id];
      touched = true;
    });
  });
  if(touched) hstore.save(hdata);
})();
function byId(a,b){ return a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }

/* разбор файла UIGF v4 */
function parseUIGF(obj){
  if(!obj || typeof obj !== "object" || !obj.info) throw new Error("Это не похоже на файл UIGF.");
  const ver = String(obj.info.version || "");
  if(!/^v4/.test(ver)) throw new Error("Нужен файл UIGF версии 4, а здесь " + (ver || "версия не указана") + ".");
  const out = [];
  Object.keys(GAMES).forEach(game => {
    (obj[game] || []).forEach(acc => {
      const recs = (acc.list || []).map(r => ({
        id: String(r.id || ""),
        k: String(game === "hk4e" ? (r.uigf_gacha_type || r.gacha_type) : r.gacha_type),
        g: String(r.gacha_id || ""),
        t: r.time || "",
        n: r.name || "",
        i: String(r.item_id || ""),
        r: String(r.rank_type || ""),
        y: r.item_type || ""
      })).filter(r => r.id);
      if(recs.length) out.push({ game:game, uid:String(acc.uid), records:recs });
    });
  });
  if(!out.length) throw new Error("В файле нет записей по поддерживаемым играм.");
  return out;
}

// какие поля более подробная выгрузка добавит к уже загруженной записи
function enrichFields(old, r){
  const out = [];
  if(r.g && r.g !== "0" && r.g !== r.k && (!old.g || old.g === "0" || old.g === old.k)) out.push("g");
  if(r.r && !old.r) out.push("r");
  if(r.y && !old.y) out.push("y");
  if(r.n && !old.n) out.push("n");
  return out;
}
function applyEnrich(old, r){
  enrichFields(old, r).forEach(f => { old[f] = r[f]; });
}

let pending = null;

function analyzeImport(parsed){
  return parsed.map(src => {
    const key = src.game + ":" + src.uid;
    const acc = hdata.accounts.find(a => a.key === key);
    const have = {};
    if(acc) acc.records.forEach(r => { have[r.id] = r; });
    const g = gameInfo(src.game);
    const byK = {};
    let nw = 0, dup = 0, enr = 0, from = "", to = "";
    src.records.forEach(r => {
      const old = have[r.id];
      byK[r.k] = byK[r.k] || { k:r.k, nw:0, tops:0, total:0 };
      byK[r.k].total++;
      if(old){
        dup++;
        if(enrichFields(old, r).length) enr++;
        return;
      }
      nw++;
      byK[r.k].nw++;
      if(r.r === g.top) byK[r.k].tops++;
      if(r.t){
        if(!from || r.t < from) from = r.t;
        if(!to || r.t > to) to = r.t;
      }
    });
    // различаются ли прогоны внутри канала — от этого зависит авторазметка 50/50
    const seen = {};
    src.records.forEach(r => {
      const gg = runKey(r);
      if(!gg) return;
      (seen[r.k] = seen[r.k] || {})[gg] = 1;
    });
    const runs = Object.keys(seen).some(k => Object.keys(seen[k]).length > 1);
    const runsNow = acc ? runsUsable(acc) : false;
    return { src:src, key:key, exists:!!acc, total:src.records.length,
      nw:nw, dup:dup, enr:enr, from:from, to:to, runs:runs, runsNow:runsNow,
      banners: Object.keys(byK).map(k => byK[k])
        .sort((a,b) => (bannerInfo(src.game,a.k).ord || 99) - (bannerInfo(src.game,b.k).ord || 99)),
      on: true };
  });
}

function previewImport(text, opts){
  opts = opts || {};
  let parsed;
  try {
    parsed = parseUIGF(JSON.parse(text));
  } catch(e){
    document.getElementById("histNote").textContent = e.message || "Файл не читается.";
    return false;
  }
  const info = (function(){ try { return JSON.parse(text).info || {}; } catch(e){ return {}; } })();
  pending = { rows: analyzeImport(parsed), info: info };
  const nothing = !pending.rows.some(r => r.nw || r.enr);
  if(opts.quiet && nothing){ pending = null; return false; }      // нечего добавлять — молчим
  if(opts.apply){ applyImport(); return true; }
  document.getElementById("impSource").textContent =
    "Источник: " + (info.export_app || "неизвестно") +
    (info.export_app_version ? " " + info.export_app_version : "") +
    " · формат " + (info.version || "?") +
    (info.export_timestamp ? " · выгружено " + new Date(info.export_timestamp * 1000).toLocaleDateString("ru-RU") : "");
  document.getElementById("impMark").value = "keep";
  document.getElementById("impEnrich").value = "1";
  renderPreview();
  document.getElementById("importOverlay").classList.add("on");
  return true;
}

function renderPreview(){
  const host = document.getElementById("impAccounts");
  host.innerHTML = "";
  pending.rows.forEach(row => {
    const g = gameInfo(row.src.game);
    const box = document.createElement("div");
    box.className = "impacc" + (row.on ? "" : " off");

    const head = document.createElement("div");
    head.className = "imphead";
    const chip = document.createElement("button");
    chip.className = "chip" + (row.on ? " on" : "");
    chip.textContent = g.name + " · " + row.src.uid;
    chip.onclick = () => { row.on = !row.on; renderPreview(); };
    const nums = document.createElement("div");
    nums.className = "impnums";
    nums.innerHTML =
      (row.exists ? "аккаунт уже загружен" : "новый аккаунт") +
      " · в файле <b>" + fmt(row.total) + "</b>" +
      " · новых <b class=\"plus\">" + fmt(row.nw) + "</b>" +
      " · уже есть <b>" + fmt(row.dup) + "</b>" +
      (row.enr ? " · дополнится <b>" + fmt(row.enr) + "</b>" : "") +
      (row.nw && row.from ? "<br>период новых: " + dmy(row.from.slice(0,10)) + " — " + dmy(row.to.slice(0,10)) : "");
    head.append(chip, nums);
    box.appendChild(head);

    if(row.nw){
      const t = document.createElement("table");
      t.innerHTML = "<thead><tr><th>Канал</th><th>Новых</th><th>Из них " + g.topName + "</th><th>Всего в файле</th></tr></thead>";
      const tb = document.createElement("tbody");
      row.banners.forEach(b => {
        const info = bannerInfo(row.src.game, b.k);
        const tr = document.createElement("tr");
        tr.style.cursor = "default";
        tr.innerHTML = "<td>" + esc(info.n) + "</td>" +
          '<td class="' + (b.nw ? "poly" : "") + '">' + (b.nw || "—") + "</td>" +
          '<td class="rare">' + (b.tops || "—") + "</td>" +
          "<td style=\"color:var(--dim)\">" + fmt(b.total) + "</td>";
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      box.appendChild(t);
    }

    const note = document.createElement("p");
    if(row.runs){
      note.className = "note2 ok";
      note.textContent = row.runsNow
        ? "В файле есть прогоны баннеров — автоматическая разметка 50/50 продолжит работать."
        : "В файле есть прогоны баннеров — после загрузки отметка 50/50 начнёт применяться ко всему прогону.";
    } else {
      note.className = "note2";
      note.textContent = row.runsNow
        ? "Прогонов в этом файле нет, но они уже есть у загруженных записей — авторазметка сохранится."
        : "Прогонов баннеров в файле нет — 50/50 придётся отмечать по отдельным выпадениям.";
    }
    box.appendChild(note);
    host.appendChild(box);
  });

  const on = pending.rows.filter(r => r.on);
  const nw = on.reduce((s,r) => s + r.nw, 0);
  const enr = on.reduce((s,r) => s + r.enr, 0);
  const btn = document.getElementById("impApply");
  btn.disabled = !on.length || (!nw && !enr);
  btn.textContent = nw ? "Загрузить " + fmt(nw)
    : enr ? "Дополнить " + fmt(enr)
    : "Нечего загружать";
}

function applyImport(){
  if(!pending) return;
  const manual = document.getElementById("importOverlay").classList.contains("on");
  const enrich = document.getElementById("impEnrich").value === "1";
  const mark = document.getElementById("impMark").value;
  let added = 0, enr = 0, accs = 0;

  pending.rows.forEach(row => {
    if(!row.on) return;
    let acc = hdata.accounts.find(a => a.key === row.key);
    if(!acc){
      acc = { key:row.key, game:row.src.game, uid:row.src.uid, records:[] };
      hdata.accounts.push(acc);
      accs++;
    }
    const idx = {};
    acc.records.forEach(r => { idx[r.id] = r; });
    row.src.records.forEach(r => {
      const old = idx[r.id];
      if(old){
        if(enrich && enrichFields(old, r).length){ applyEnrich(old, r); enr++; }
        return;
      }
      idx[r.id] = r;
      acc.records.push(r);
      added++;
    });
    acc.records.sort(byId);
    if(mark === "std" || mark === "win" || mark === "manual") acc.mark50 = mark;
    hdata.active = hdata.active || acc.key;
  });

  Object.keys(runsCache).forEach(k => { delete runsCache[k]; });
  hSave();
  const gotGames = pending.rows.filter(r => r.on).map(r => r.src.game);
  pending = null;
  document.getElementById("importOverlay").classList.remove("on");
  const gk = histGameKey();
  if(manual && gotGames.length && gotGames.indexOf(gk) === -1){
    const n = navByHist(gotGames[0]);
    if(n) setNav(n.id, "history");
  }
  renderHistory();
  document.getElementById("histNote").textContent =
    "Загружено " + added + " новых записей" +
    (enr ? ", дополнено " + enr : "") +
    (accs ? ", аккаунтов добавлено: " + accs : "") + ".";
}

/* статистика по каналу */
function bannerStats(acc, k){
  const g = gameInfo(acc.game);
  const list = acc.records.filter(r => r.k === k).sort(byId);
  let tops = [], since = 0;
  list.forEach(r => {
    since++;
    if(r.r === g.top){ tops.push({ rec:r, pulls:since }); since = 0; }
  });
  const info = bannerInfo(acc.game, k);
  return {
    k:k, info:info, total:list.length, tops:tops, pity:since,
    avg: tops.length ? tops.reduce((s,x) => s + x.pulls, 0) / tops.length : 0,
    first: list.length ? list[0].t : "", last: list.length ? list[list.length-1].t : ""
  };
}
function accountBanners(acc){
  const keys = [];
  acc.records.forEach(r => { if(keys.indexOf(r.k) === -1) keys.push(r.k); });
  // порядок задаётся явно: числовые ключи объекта иначе встают по возрастанию
  keys.sort((a,b) => (bannerInfo(acc.game,a).ord || 99) - (bannerInfo(acc.game,b).ord || 99));
  return keys.map(k => bannerStats(acc, k));
}

function renderHistory(){
  const acc = HA();
  const g = acc ? gameInfo(acc.game) : null;
  document.getElementById("hTitle").childNodes[0].nodeValue = "История круток";
  const gk = histGameKey();
  document.getElementById("hSub").textContent = acc ? g.name + " · UID " + acc.uid : (gk ? gameInfo(gk).name + " · " : "") + "файл не загружен";

  const box = document.getElementById("histAccounts");
  box.innerHTML = "";
  const mine = hdata.accounts.filter(a => !gk || a.game === gk);
  box.classList.toggle("hidden", mine.length < 2);
  mine.forEach(a => {
    const b = document.createElement("button");
    b.className = "chip" + (acc && a.key === acc.key ? " on" : "");
    b.textContent = "UID " + a.uid;
    b.onclick = () => { hdata.active = a.key; histBanner = null; histPage = 0; hSave(); renderHistory(); };
    box.appendChild(b);
  });

  const body = document.getElementById("histBody");
  body.classList.toggle("hidden", !acc);
  if(!acc) return;

  const banners = accountBanners(acc);
  const total = acc.records.length;
  const tops = banners.reduce((s,b) => s + b.tops.length, 0);
  document.getElementById("gTotal").textContent = fmt(total);
  document.getElementById("gTopLabel").textContent = "Выпадений " + g.topName;
  document.getElementById("gTop").textContent = tops;
  document.getElementById("gAvg").textContent = tops ? fmtP(total / tops) : "—";
  document.getElementById("gBanners").textContent = banners.length;
  const times = acc.records.map(r => r.t).filter(Boolean).sort();
  document.getElementById("gRange").textContent = times.length
    ? "с " + times[0].slice(0,10).split("-").reverse().join(".") + " по " + times[times.length-1].slice(0,10).split("-").reverse().join(".")
    : "";

  const grid = document.getElementById("bannerGrid");
  grid.innerHTML = "";
  if(histBanner && !banners.some(b => b.k === histBanner)) histBanner = null;
  banners.forEach(b => {
    // гарант в долгу: последнее ценное выпадение канала помечено проигрышем
    const seq = resolveTops(acc, b);
    const lastTop = seq[seq.length - 1];
    const owed = !!(lastTop && lastTop.st === "lose");
    const card = document.createElement("button");
    const share = Math.min(100, Math.round(b.pity / b.info.pity * 100));
    card.className = "bcard" + (share >= 75 ? " hot" : "") + (histBanner === b.k ? " on" : "");
    card.onclick = () => {
      histBanner = histBanner === b.k ? null : b.k;
      histPage = 0;
      renderHistory();
      if(histBanner) document.getElementById("rareSection").scrollIntoView({ behavior:"smooth", block:"start" });
    };
    card.innerHTML =
      '<div class="nm">' + esc(b.info.n) + '</div>' +
      '<div class="sub2">' + esc(b.info.s) + ' · до гаранта ' + b.info.pity + '</div>' +
      '<div class="big num">' + fmt(b.total) + '<small>круток</small></div>' +
      '<div class="line"><span>' + g.topName.charAt(0).toUpperCase() + g.topName.slice(1) + '</span><b>' + b.tops.length + '</b></div>' +
      '<div class="line"><span>В среднем на одно</span><b>' + (b.tops.length ? fmtP(b.avg) : "—") + '</b></div>' +
      '<div class="line"><span>Круток без выпадения</span><b>' + b.pity + '</b></div>' +
      (b.info.pity && owed
        ? '<div class="line"><span>До гаранта осталось</span><b>' + Math.max(0, b.info.pity - b.pity) + " из " + b.info.pity + '</b></div>'
        : "") +
      '<div class="bar"><i style="width:' + share + '%"></i></div>' +
      '<div class="more">' + (histBanner === b.k ? "список открыт ниже" : "показать выпадения") + '</div>';
    grid.appendChild(card);
  });

  renderRareTable(acc, banners);
}

function rareView(){ return ui.rareView === "grid" ? "grid" : "table"; }

// метка 50/50 — одна и та же в таблице и в сетке
function makeTag(acc, x){
  const tag = document.createElement("span");
  tag.className = "tag " + x.st + (x.fixed ? " fixed" : "");
  tag.textContent = x.st === "win" ? "выигран" : x.st === "lose" ? "проигран" :
                    x.st === "guard" ? "гарант" : "не размечен";
  tag.title = x.st === "guard" && x.featured
    ? "Разыгрываемый персонаж, но перед ним проигрыш — значит это гарант."
    : x.fixed
      ? "Отмечено вручную. Нажмите: разыгрываемый → проигрыш → без метки."
      : x.src === "std"
        ? (x.st === "lose" ? "Из пула проигрыша на эту дату — значит 50/50 проигран." : "Не из пула проигрыша — значит 50/50 выигран.") +
          " Нажмите, чтобы отметить вручную."
        : "Определено автоматически. Нажмите, чтобы отметить вручную.";
  tag.onclick = () => {
    markTop(acc, x, nextMark(acc, x));
    renderHistory();
  };
  return tag;
}
function pullsClass(n){ return n <= 30 ? "poly" : n >= 70 ? "master" : ""; }

function renderRareTable(acc, banners){
  const sect = document.getElementById("rareSection");
  const tb = document.getElementById("histBanners");
  const grid = document.getElementById("rareGrid");
  const pager = document.getElementById("histPager");
  const stats = document.getElementById("fiftyStats");
  const b = histBanner ? banners.find(x => x.k === histBanner) : null;

  sect.classList.toggle("hidden", !b);
  if(!b) return;
  document.getElementById("rareTitle").textContent = "Выпадения · " + b.info.n;

  const limited = b.info.pool === "limited";
  const tops = resolveTops(acc, b);
  const hint = document.getElementById("markHint");
  const wd = document.getElementById("winDefault");
  wd.classList.toggle("hidden", !limited);
  document.getElementById("stdPoolBtn").classList.toggle("hidden", !limited || !STD_POOL[acc.game]);
  if(limited){
    const un = tops.filter(x => x.st === "none").length;
    const mode = markMode(acc);
    const mi = MARK_MODES.findIndex(m => m.id === mode);
    wd.textContent = MARK_MODES[mi].btn;
    wd.title = "Нажмите, чтобы сменить режим разметки 50/50";
    wd.onclick = () => { acc.mark50 = MARK_MODES[(mi + 1) % MARK_MODES.length].id; hSave(); renderHistory(); };
    if(mode === "std" && !itemsDb[acc.game]) ensureItems(acc.game, () => { if(document.body.classList.contains("tab-history")) renderHistory(); });
    const withRun = tops.filter(x => x.run).length;
    const runsPart = runsUsable(acc)
      ? " Отметка применяется ко всему прогону баннера" +
        (withRun < tops.length ? " — прогон известен у " + withRun + " из " + tops.length + " выпадений." : ".")
      : "";
    const stdOk = !!(STD_ELIGIBLE[acc.game] || {})[b.k];
    hint.textContent = mode === "std" && stdOk
      ? "Если выпал персонаж или оружие из пула проигрыша (стандартные и добавленные к ним) — 50/50 проигран, иначе выигран; после проигрыша — гарант. Ручные отметки важнее." + runsPart
      : mode === "win" || mode === "std"
      ? (mode === "std" ? "У этого баннера свой пул, поэтому неразмеченные считаются выигранными. " : "") + "Отмечайте только проигрыши — остальное считается выигранным, а выпадение после проигрыша становится гарантом." + runsPart
      : (un ? "Не размечено выпадений: " + un + ". Клик по метке: выигран → проигран → без метки."
            : "Все выпадения размечены.") + runsPart;
  } else { hint.textContent = ""; }

  // серии 50/50
  stats.innerHTML = "";
  if(limited && tops.length){
    const s = fiftyStats(tops);
    const card = (k, v, cls) => {
      const d = document.createElement("div");
      d.className = "tot" + (cls ? " " + cls : "");
      d.innerHTML = '<div class="k">' + k + '</div><div class="v num">' + v + '</div>';
      return d;
    };
    const streak = s.cur
      ? s.cur + (s.kind === "win" ? " подряд выиграно" : " подряд проиграно")
      : "—";
    stats.append(
      card("Сыграно 50/50", s.played + (s.unmarked ? " · " + s.unmarked + " без метки" : "")),
      card("Выиграно", s.win + " · " + Math.round(s.rate) + "%", "gold"),
      card("Сейчас серия", streak, s.kind === "lose" ? "cr" : "gold"),
      card("Лучшая серия побед", s.bestW, "gold"),
      card("Худшая серия поражений", s.bestL, "cr")
    );
  }

  renderBannerChart(b, tops, limited);
  renderLuck(acc, b, tops, limited);

  // переключатель представления
  const seg = document.getElementById("rareViewSeg");
  seg.innerHTML = "";
  [["table","таблица"],["grid","портреты"]].forEach(([v,label]) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    if(rareView() === v) btn.classList.add("on");
    btn.onclick = () => { ui.rareView = v; saveUI(); renderRareTable(acc, banners); };
    seg.appendChild(btn);
  });

  const asGrid = rareView() === "grid";
  document.getElementById("rareTableCard").classList.toggle("hidden", asGrid);
  grid.classList.toggle("hidden", !asGrid);

  if(!tops.length){
    const noRank = acc.records.every(r => !r.r);
    const msg = noRank ? "В файле нет данных о редкости — доступны только счётчики круток."
                       : "На этом канале ценных выпадений пока нет.";
    tb.innerHTML = '<tr><td colspan="6" class="empty">' + msg + '</td></tr>';
    grid.innerHTML = '<p class="nodata">' + msg + '</p>';
    pager.innerHTML = "";
    return;
  }

  const rows = tops.slice().reverse();
  const per = rarePer(asGrid);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  if(histPage > pages - 1) histPage = pages - 1;
  const from = histPage * per;
  const page = rows.slice(from, from + per);

  if(asGrid){
    grid.innerHTML = "";
    page.forEach(x => {
      const card = document.createElement("div");
      card.className = "pcard" + (limited && (x.st === "win" || x.st === "lose") ? " " + x.st : "");
      const pic = document.createElement("div");
      attachIcon(pic, acc.game, x.rec);
      if(pic.children.length) card.appendChild(pic.children[0]);
      const nm = document.createElement("div");
      nm.className = "nm2";
      const nmIn = document.createElement("span");
      nmIn.textContent = x.rec.n || "#" + x.rec.i;
      nm.appendChild(nmIn);
      const pl = document.createElement("div");
      pl.className = "pl num " + pullsClass(x.pulls);
      pl.textContent = x.pulls;
      pl.title = x.pulls + " круток от предыдущего ценного выпадения" +
        (x.pulls <= 30 ? " — быстро" : x.pulls >= 70 ? " — долго" : "");
      const dt = document.createElement("div");
      dt.className = "dt";
      dt.textContent = x.rec.t.slice(0,10).split("-").reverse().join(".");
      card.append(nm, pl, dt);
      if(limited) card.appendChild(makeTag(acc, x));
      grid.appendChild(card);
    });
  } else {
    tb.innerHTML = "";
    page.forEach(x => {
      const tr = document.createElement("tr");
      tr.style.cursor = "default";
      tr.innerHTML =
        '<td style="color:var(--dim)">' + esc(x.rec.t.slice(0,10).split("-").reverse().join(".")) + '</td>' +
        '<td class="pic"></td>' +
        '<td class="rare">' + esc(x.rec.n || "#" + x.rec.i) + '</td>' +
        '<td>' + esc(typeRu(x.rec.y, b.info.s)) + '</td>' +
        '<td class="' + pullsClass(x.pulls) + '">' + x.pulls + '</td>';
      attachIcon(tr.children[1], acc.game, x.rec);
      const last = document.createElement("td");
      tr.appendChild(last);
      if(limited) last.appendChild(makeTag(acc, x));
      tr.dataset.rid = x.rec.id;
      tb.appendChild(tr);
    });
  }

  pager.innerHTML = "";
  if(pages > 1){
    const mk = (label, target, off) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.disabled = off;
      if(!off) btn.onclick = () => { histPage = target; renderRareTable(acc, banners); };
      return btn;
    };
    const info = document.createElement("span");
    info.textContent = "Записи " + (from + 1) + "\u2013" + Math.min(from + per, rows.length) + " из " + rows.length;
    pager.append(info, mk("\u2039", histPage - 1, histPage === 0), mk("\u203a", histPage + 1, histPage >= pages - 1));
  }
}

/* график: сколько круток ушло на каждое выпадение */
function renderBannerChart(b, tops, limited){
  const host = document.getElementById("bannerChart");
  const card = document.getElementById("bannerChartCard");
  if(tops.length < 2){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");

  const W = chartW(host), H = 210, L = 30, R = 8, T = 16, B = 40;
  const list = tops.slice(W < 500 ? -24 : -40);   // на узком экране — последние выпадения
  const iw = W - L - R, ih = H - T - B;
  const step = iw / list.length, bw = Math.min(step - 5, 26);
  const cap = b.info.pity;
  const max = Math.max(cap, ...list.map(x => x.pulls));
  const avg = list.reduce((s,x) => s + x.pulls, 0) / list.length;
  const y = v => T + ih - (v / max) * ih;

  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Круток на выпадение">' +
    '<defs>' +
    '<linearGradient id="bw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffdf95"/><stop offset="100%" stop-color="#c59a3c"/></linearGradient>' +
    '<linearGradient id="bl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e0576f"/><stop offset="100%" stop-color="#8a3247"/></linearGradient>' +
    '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9aa3ad"/><stop offset="100%" stop-color="#4a545e"/></linearGradient>' +
    '<linearGradient id="bn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f6b78"/><stop offset="100%" stop-color="#3a3742"/></linearGradient>' +
    '</defs>';
  const tick = max > 90 ? 30 : 20;
  for(let v = 0; v <= max; v += tick){
    s += '<line x1="' + L + '" y1="' + y(v).toFixed(1) + '" x2="' + (W-R) + '" y2="' + y(v).toFixed(1) + '" stroke="rgba(255,255,255,.05)"/>' +
         '<text x="' + (L-8) + '" y="' + (y(v)+3.5).toFixed(1) + '" fill="#5e5c68" font-size="10" text-anchor="end">' + v + '</text>';
  }
  s += '<line x1="' + L + '" y1="' + y(cap).toFixed(1) + '" x2="' + (W-R) + '" y2="' + y(cap).toFixed(1) +
       '" stroke="rgba(224,87,111,.45)" stroke-dasharray="5 5"/>' +
       '<text x="' + (W-R) + '" y="' + (y(cap)-5).toFixed(1) + '" fill="#a8556a" font-size="10" text-anchor="end">гарант ' + cap + '</text>';
  s += '<line x1="' + L + '" y1="' + y(avg).toFixed(1) + '" x2="' + (W-R) + '" y2="' + y(avg).toFixed(1) +
       '" stroke="rgba(240,194,100,.45)" stroke-dasharray="3 4"/>' +
       '<text x="' + (L+4) + '" y="' + (y(avg)-5).toFixed(1) + '" fill="#a9853a" font-size="10">среднее ' + fmtP(avg) + '</text>';

  list.forEach((x,i) => {
    const cx = L + (i + 0.5) * step;
    const hgt = Math.max(2, (x.pulls / max) * ih);
    const fill = !limited ? "url(#bw)" : x.st === "lose" ? "url(#bl)" : x.st === "guard" ? "url(#bg)"
               : x.st === "none" ? "url(#bn)" : "url(#bw)";
    s += '<g class="bar-h"><rect class="cbar" data-i="' + i + '" data-x="' + (cx / W * 100).toFixed(2) +
         '" data-y="' + ((T + ih - hgt) / H * 100).toFixed(2) + '" style="cursor:pointer" x="' + (cx - bw/2).toFixed(1) +
         '" y="' + (T+ih-hgt).toFixed(1) + '" width="' + bw.toFixed(1) +
         '" height="' + hgt.toFixed(1) + '" fill="' + fill + '" rx="3"></rect>';
    if(step > 26) s += '<text x="' + cx.toFixed(1) + '" y="' + (T+ih-hgt-6).toFixed(1) + '" fill="#7d7a86" font-size="9.5" text-anchor="middle">' + x.pulls + '</text>';
    s += '</g>';
  });
  s += '<text x="' + L + '" y="' + (H-8) + '" fill="#5e5c68" font-size="10">раньше</text>' +
       '<text x="' + (W-R) + '" y="' + (H-8) + '" fill="#5e5c68" font-size="10" text-anchor="end">позже</text></svg>';

  host.innerHTML = s + (limited
    ? '<div class="legend"><span><i style="background:linear-gradient(180deg,#ffdf95,#c59a3c)"></i>50/50 выигран</span>' +
      '<span><i style="background:linear-gradient(180deg,#e0576f,#8a3247)"></i>проигран</span>' +
      '<span><i style="background:linear-gradient(180deg,#9aa3ad,#4a545e)"></i>гарант</span>' +
      '<span><i style="background:linear-gradient(180deg,#6f6b78,#3a3742)"></i>без метки</span></div>'
    : '<div class="legend"><span><i style="background:linear-gradient(180deg,#ffdf95,#c59a3c)"></i>круток на выпадение</span></div>');

  const tip = document.getElementById("chartTip");
  const label = { win:"50/50 выигран", lose:"50/50 проигран", guard:"гарант", none:"без метки" };
  host.querySelectorAll(".cbar").forEach(rect => {
    const x = list[+rect.dataset.i];
    const show = () => {
      tip.innerHTML = '<b>' + esc(x.rec.n || "#" + x.rec.i) + '</b>' +
        x.pulls + " круток · " + esc(x.rec.t.slice(0,10).split("-").reverse().join(".")) +
        (limited ? '<br><span class="st-' + x.st + '">' + label[x.st] + '</span>' : "");
      tip.style.left = rect.dataset.x + "%";
      tip.style.top = "calc(" + rect.dataset.y + "% - 10px)";
      tip.classList.remove("hidden");
    };
    rect.addEventListener("mouseenter", show);
    rect.addEventListener("mousemove", show);
    rect.addEventListener("mouseleave", () => tip.classList.add("hidden"));
    rect.addEventListener("click", () => jumpToDrop(x.rec.id));
  });
}

/* ── удача: сравнение с моделью гаранта ── */
// распределение суммы n независимых «круток до топа»; при больших n — нормальное приближение
function sumLuck(pmf, n, observed){
  const mean = pmf.reduce((s, p, i) => s + p * i, 0);
  if(n > 40){
    const v = pmf.reduce((s, p, i) => s + p * (i - mean) * (i - mean), 0) * n;
    const z = (observed + 0.5 - n * mean) / Math.sqrt(v);
    return 1 - normCdf(z);                     // доля игроков, которым понадобилось больше
  }
  let dist = [1];
  for(let k = 0; k < n; k++){
    const nx = new Float64Array(dist.length + pmf.length - 1);
    for(let a = 0; a < dist.length; a++){
      const da = dist[a];
      if(da < 1e-15) continue;
      for(let i = 1; i < pmf.length; i++) nx[a + i] += da * pmf[i];
    }
    dist = nx;
  }
  let more = 0, eq = dist[observed] || 0;
  for(let s = observed + 1; s < dist.length; s++) more += dist[s];
  return more + eq / 2;
}
function normCdf(z){
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
// доля тех, у кого при честной монетке выигрышей меньше, чем у вас
function coinLuck(n, w, p){
  let less = 0, eq = 0, c = 1;
  for(let k = 0; k <= n; k++){
    if(k > 0) c = c * (n - k + 1) / k;
    const pr = c * Math.pow(p, k) * Math.pow(1 - p, n - k);
    if(k < w) less += pr; else if(k === w) eq = pr;
  }
  return less + eq / 2;
}
function luckWord(share){
  const p = Math.round(share * 100);
  if(p >= 50) return "удачнее, чем у " + p + "% игроков";
  return "хуже, чем у " + (100 - p) + "% игроков";
}
function renderLuck(acc, b, tops, limited){
  const box = document.getElementById("luckBox");
  const hist = document.getElementById("pityHistCard");
  const mname = (CHANNEL_MODEL[acc.game] || {})[b.k];
  const tw = acc.game === "nap" ? "S-ранг" : "5★";
  document.getElementById("pityHistTitle").textContent = "На какой крутке выпадал " + tw;
  // первое выпадение могло начаться до начала выгрузки — его круток не видно целиком
  const done = tops.slice(1);
  if(!mname || done.length < 3){
    box.classList.add("hidden");
    hist.classList.add("hidden");
    return;
  }
  const pmf = pityPmf(mname);
  const exp = pityMean(mname);
  const sum = done.reduce((s, x) => s + x.pulls, 0);
  const avg = sum / done.length;
  const share = sumLuck(pmf, done.length, sum);
  const cls = share >= .5 ? "good" : "bad";
  let h = '<div class="luckmain ' + cls + '"><span class="v num">' + fmtP(avg) + '</span>' +
    '<span class="t">круток в среднем на один ' + tw + " (обычно " + fmtP(exp) + ") — <b>" + luckWord(share) +
    "</b> · посчитано по " + done.length + " " + (done.length % 10 === 1 && done.length % 100 !== 11 ? "выпадению" : "выпадениям") + "</span></div>";
  if(limited){
    const play = done.filter(x => x.st === "win" || x.st === "lose");
    if(play.length >= 3){
      const w = play.filter(x => x.st === "win").length;
      const p = mname === "char" ? .5 : .75;
      const cs = coinLuck(play.length, w, p);
      h += '<div class="lucksub">50/50: выиграно ' + w + " из " + play.length + " (" + Math.round(w / play.length * 100) + "% при ожидаемых " +
        Math.round(p * 100) + "%) — " + luckWord(cs) + "</div>";
    }
  }
  h += '<div class="lucknote">Первый ' + tw + ' канала не учитывается: часть круток до него могла не попасть в выгрузку. Модель гаранта — общепринятая оценка сообщества.</div>';
  box.innerHTML = h;
  box.classList.remove("hidden");
  renderPityHist(done, pmf, PITY_MODEL[mname]);
}
// на какой крутке выпадал S-ранг (5★): ваши выпадения против ожидаемых по модели
function renderPityHist(done, pmf, m){
  const card = document.getElementById("pityHistCard");
  const host = document.getElementById("pityHist");
  card.classList.remove("hidden");
  const bw = 10, nb = Math.ceil(m.hard / bw);
  const obs = new Array(nb).fill(0), expd = new Array(nb).fill(0);
  done.forEach(x => { obs[Math.min(nb - 1, Math.floor((Math.min(x.pulls, m.hard) - 1) / bw))]++; });
  for(let i = 1; i < pmf.length; i++) expd[Math.floor((i - 1) / bw)] += pmf[i] * done.length;
  const W = chartW(host), H = 210, L = 30, R = 8, T = 26, B = 34;
  const iw = W - L - R, ih = H - T - B, step = iw / nb, bwid = Math.min(step - 10, 52);
  const top = Math.max(1, ...obs, ...expd);
  const max = top * 1.12;
  const y = v => T + ih - v / max * ih;
  let s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Распределение выпадений по гаранту">';
  const tick = top > 12 ? Math.ceil(top / 4) : top > 4 ? 2 : 1;
  for(let v = 0; v <= top; v += tick){
    s += '<line x1="' + L + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - R) + '" y2="' + y(v).toFixed(1) + '" stroke="rgba(255,255,255,.05)"/>' +
      '<text x="' + (L - 8) + '" y="' + (y(v) + 3.5).toFixed(1) + '" fill="#5e5c68" font-size="10" text-anchor="end">' + v + "</text>";
  }
  let line = "";
  for(let i = 0; i < nb; i++){
    const cx = L + (i + .5) * step;
    const hh = obs[i] / max * ih;
    s += '<rect x="' + (cx - bwid / 2).toFixed(1) + '" y="' + (T + ih - hh).toFixed(1) + '" width="' + bwid.toFixed(1) + '" height="' + Math.max(hh, obs[i] ? 2 : 0).toFixed(1) + '" rx="3" fill="url(#bw2)"><title>' +
      obs[i] + " из " + done.length + " · ожидалось " + fmtP(expd[i]) + "</title></rect>";
    line += (i ? " L" : "M") + cx.toFixed(1) + " " + y(expd[i]).toFixed(1);
    s += '<text x="' + cx.toFixed(1) + '" y="' + (H - 14) + '" fill="#5e5c68" font-size="10" text-anchor="middle">' + (W >= 500 ? (i * bw + 1) + "–" + Math.min(m.hard, (i + 1) * bw) : "≤" + Math.min(m.hard, (i + 1) * bw)) + "</text>";
  }
  // начало мягкого гаранта — тонкая вертикальная линия в точном месте шкалы, а не заливка
  const sx = L + ((m.soft - 1) / bw) * step;
  s += '<line x1="' + sx.toFixed(1) + '" y1="' + (T - 10) + '" x2="' + sx.toFixed(1) + '" y2="' + (T + ih) + '" stroke="rgba(240,194,100,.45)" stroke-dasharray="3 3"/>' +
    '<text x="' + (sx - 5).toFixed(1) + '" y="' + (T - 4) + '" fill="#a9853a" font-size="10" text-anchor="end">мягкий гарант с ' + m.soft + "</text>";
  s += '<path d="' + line + '" fill="none" stroke="#8794a1" stroke-width="1.6" stroke-dasharray="4 4"/>';
  for(let i = 0; i < nb; i++) s += '<circle cx="' + (L + (i + .5) * step).toFixed(1) + '" cy="' + y(expd[i]).toFixed(1) + '" r="2.6" fill="#8794a1"/>';
  // подписи — поверх линии и с тёмной обводкой; если рядом точка ожидания, подпись уходит
  // внутрь высокого столбца или поднимается над точкой, чтобы ничего не перекрывалось
  for(let i = 0; i < nb; i++){
    if(!obs[i]) continue;
    const cx = L + (i + .5) * step, hh = obs[i] / max * ih, dot = y(expd[i]);
    let ly = T + ih - hh - 6, fill = "#c9c5d1", halo = "#101015";
    if(Math.abs(ly - 3.5 - dot) < 11){
      if(hh > 24){ ly = T + ih - hh + 15; fill = "#2a1f06"; halo = "#f3cc7c"; }
      else ly = Math.min(ly, dot - 8);
    }
    s += '<text x="' + cx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="' + fill + '" font-size="10.5" font-weight="600" text-anchor="middle"' +
      ' stroke="' + halo + '" stroke-width="3" paint-order="stroke">' + obs[i] + "</text>";
  }
  s = s.replace('<svg ', '<svg ') + '<defs><linearGradient id="bw2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffdf95"/><stop offset="100%" stop-color="#c59a3c"/></linearGradient></defs></svg>';
  host.innerHTML = s + '<div class="legend"><span><i style="background:linear-gradient(180deg,#ffdf95,#c59a3c)"></i>ваши выпадения</span>' +
    '<span><i style="background:#8794a1;border-radius:50%"></i>ожидаемо по модели</span>' +
    '<span><i style="width:2px;height:10px;border-radius:0;background:rgba(240,194,100,.6)"></i>начало мягкого гаранта</span></div>';
}

// сколько выпадений на странице: таблица — 20, сетка портретов — целое число рядов,
// чтобы последний ряд не оставался неполным (7 столбцов → 21, 5 → 20, 3 → 21)
function rarePer(asGrid){
  if(!asGrid) return 20;
  const sec = document.getElementById("rareSection");
  const w = sec ? sec.clientWidth : 0;
  const cols = Math.max(1, Math.floor((w + 8) / (122 + 8)));
  return cols * Math.ceil(20 / cols);
}

/* переход от столбца к строке списка */
function jumpToDrop(id){
  const acc = HA();
  if(!acc) return;
  const banners = accountBanners(acc);
  const b = banners.find(x => x.k === histBanner);
  if(!b) return;
  const rows = resolveTops(acc, b).slice().reverse();
  const idx = rows.findIndex(x => x.rec.id === id);
  if(idx === -1) return;
  const per = rarePer(rareView() === "grid");
  const page = Math.floor(idx / per);
  if(page !== histPage){ histPage = page; renderRareTable(acc, banners); }
  const tr = document.getElementById("histBanners").children[idx % per];
  if(!tr) return;
  tr.classList.remove("flash");
  void (tr.offsetWidth || 0);
  tr.classList.add("flash");
  if(tr.scrollIntoView) tr.scrollIntoView({ behavior:"smooth", block:"center" });
}

document.getElementById("rareClose").onclick = () => { histBanner = null; renderHistory(); };

/* ── слежение за файлом истории ──
   Chrome и Edge умеют запоминать выбранный файл: страница получает на него ссылку
   и при следующем открытии перечитывает файл сама, без диалога выбора. */
const FS_DB = "zzz-fs-v1", FS_STORE = "handles", FS_KEY = "history";
function fsSupported(){
  try { return !!(window.showOpenFilePicker && window.indexedDB); } catch(e){ return false; }
}
function idbRun(mode, fn){
  return new Promise((res, rej) => {
    const rq = indexedDB.open(FS_DB, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore(FS_STORE); };
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => {
      const db = rq.result;
      const tx = db.transaction(FS_STORE, mode);
      const out = fn(tx.objectStore(FS_STORE));
      tx.oncomplete = () => { db.close(); res(out && out.result); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
  });
}
let fsHandle = null;

function renderWatchRow(state){
  const btn = document.getElementById("watchHist");
  const row = document.getElementById("watchRow");
  btn.classList.toggle("hidden", !fsSupported() || !!fsHandle);
  row.classList.toggle("hidden", !fsHandle);
  if(!fsHandle) return;
  row.innerHTML = "";
  const dot = document.createElement("span");
  dot.className = "dot" + (state === "wait" ? " wait" : "");
  const txt = document.createElement("span");
  txt.innerHTML = "Файл <b>" + esc(ui.fsName || "истории") + "</b> — " +
    (state === "wait" ? "нужно подтвердить доступ"
     : state === "fresh" ? "новых записей нет"
     : ui.fsSeen ? "проверен " + ui.fsSeen : "будет перечитан при открытии");
  const upd = document.createElement("button");
  upd.className = "ghost";
  upd.textContent = state === "wait" ? "Разрешить и обновить" : "Обновить сейчас";
  upd.onclick = () => readWatched(true);
  const mode = document.createElement("button");
  mode.className = "ghost";
  mode.textContent = ui.fsAuto ? "загружать сразу" : "показывать предпросмотр";
  mode.title = "Как поступать с новыми записями";
  mode.onclick = () => { ui.fsAuto = !ui.fsAuto; saveUI(); renderWatchRow(); };
  const off = document.createElement("button");
  off.className = "ghost danger";
  off.textContent = "Не следить";
  off.onclick = () => {
    fsHandle = null;
    delete ui.fsName; delete ui.fsStamp; delete ui.fsSeen;
    saveUI();
    idbRun("readwrite", st => st.delete(FS_KEY)).catch(() => {});
    renderWatchRow();
  };
  row.append(dot, txt, upd, mode, off);
}

function watchFile(){
  if(!fsSupported()) return;
  window.showOpenFilePicker({
    multiple: false,
    types: [{ description: "История круток (UIGF)", accept: { "application/json": [".json"] } }]
  }).then(res => {
    fsHandle = res[0];
    ui.fsName = fsHandle.name;
    delete ui.fsStamp;
    saveUI();
    return idbRun("readwrite", st => st.put(fsHandle, FS_KEY)).catch(() => {});
  }).then(() => readWatched(true)).catch(() => {});
}

function readWatched(manual){
  if(!fsHandle) return;
  const need = manual ? "requestPermission" : "queryPermission";
  Promise.resolve(fsHandle.queryPermission({ mode: "read" })).then(p => {
    if(p === "granted") return "granted";
    if(!manual) return p;
    return fsHandle.requestPermission({ mode: "read" });
  }).then(p => {
    if(p !== "granted"){ renderWatchRow("wait"); return; }
    return fsHandle.getFile().then(file => {
      const stamp = file.lastModified + ":" + file.size;
      if(!manual && ui.fsStamp === stamp){ renderWatchRow(); return; }   // файл не менялся
      return file.text().then(text => {
        ui.fsStamp = stamp;
        ui.fsSeen = new Date().toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
        saveUI();
        const got = previewImport(text, { quiet: true, apply: !!ui.fsAuto });
        renderWatchRow(got ? null : "fresh");
      });
    });
  }).catch(() => { renderWatchRow("wait"); });
}

function restoreWatch(){
  if(!fsSupported()) { renderWatchRow(); return; }
  idbRun("readonly", st => st.get(FS_KEY)).then(hnd => {
    if(!hnd) { renderWatchRow(); return; }
    fsHandle = hnd;
    ui.fsName = ui.fsName || hnd.name;
    renderWatchRow();
    readWatched(false);
  }).catch(() => renderWatchRow());
}

/* загрузка файла */
function readHistFile(file){
  if(!file) return;
  const r = new FileReader();
  r.onload = () => previewImport(r.result);
  r.onerror = () => { document.getElementById("histNote").textContent = "Файл не прочитался."; };
  r.readAsText(file);
}
document.getElementById("pickHist").onclick = () => document.getElementById("histFile").click();
document.getElementById("watchHist").onclick = watchFile;
document.getElementById("histFile").onchange = function(){
  readHistFile(this.files[0]);
  this.value = "";
};
const dz = document.getElementById("dropZone");
["dragenter","dragover"].forEach(ev => dz.addEventListener(ev, e => {
  e.preventDefault();
  dz.classList.add("over");
}));
["dragleave","drop"].forEach(ev => dz.addEventListener(ev, e => {
  e.preventDefault();
  if(ev === "dragleave" && dz.contains(e.relatedTarget)) return;
  dz.classList.remove("over");
}));
dz.addEventListener("drop", e => {
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  readHistFile(f);
});
document.getElementById("clearHist").onclick = () => {
  const acc = HA();
  if(!acc){ document.getElementById("histNote").textContent = "Загружать нечего — история пуста."; return; }
  askConfirm("Удалить историю аккаунта?",
    gameInfo(acc.game).name + " · " + acc.uid + " — " + acc.records.length + " записей будут удалены.",
    "Удалить",
    () => {
      hdata.accounts = hdata.accounts.filter(a => a.key !== acc.key);
      const rest = hdata.accounts.filter(a => a.game === acc.game);
      hdata.active = rest[0] ? rest[0].key : (hdata.accounts[0] ? hdata.accounts[0].key : null);
      hSave();
      renderHistory();
    });
};
