"use strict";
/* ── витрина: сборки агентов ZZZ из профиля игры через Enka.Network ──
   Enka читает только то, что игрок выставил в витрину профиля. Каждый ответ сохраняется,
   поэтому со временем копится сборка всех агентов, которых вы когда-либо показывали. */

const enkaStore = makeStore("zzz-enka-v1");
let enkaData = enkaStore.load();
if(!enkaData || typeof enkaData !== "object") enkaData = {};
function enkaSave(){ enkaStore.save(enkaData); }

let sbuild = null, sbuildLoading = false;
function ensureBuild(cb){
  if(sbuild){ cb && cb(); return; }
  if(sbuildLoading) return;
  sbuildLoading = true;
  fetch("items/data/nap_build.json", { cache:"no-cache" }).then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => { sbuild = j; cb && cb(); })
    .catch(() => { const n = document.getElementById("scNote"); if(n) n.textContent = "Не удалось загрузить справочник характеристик."; })
    .finally(() => { sbuildLoading = false; });
}

// стихии и классы — как они называются в игре; особые стихии — разновидности обычных
const SC_EL = {
  Fire:{ n:"Огонь", c:"#ff6a3d" }, Ice:{ n:"Лёд", c:"#8fdcff" }, Elec:{ n:"Электро", c:"#4f9dff" },
  Physics:{ n:"Физ.", c:"#f2c14e" }, Ether:{ n:"Эфир", c:"#ff4fd2" }, Wind:{ n:"Ветер", c:"#4fe3b0" }, Lumen:{ n:"Люмен", c:"#ffe98a" },
  FireFrost:{ n:"Мороз", base:"Ice" }, AuricEther:{ n:"Аура-тушь", base:"Ether" }, ZhenZhenAssault:{ n:"Остриё", base:"Physics" }
};
function scElement(list){
  list = list || [];
  const sp = list.find(e => SC_EL[e] && SC_EL[e].base);
  const key = sp || list[0] || "";
  const e = SC_EL[key];
  if(!e) return { n:key, c:"#f0c264", key };
  const base = e.base ? SC_EL[e.base] : e;
  return { n:e.n, c:base.c, key: e.base || key };
}
const SC_PRO = { Attack:"Нападение", Stun:"Устрашение", Anomaly:"Аномалия", Support:"Поддержка", Defense:"Оборона", Rupture:"Разрушение", Armorer:"Оружейник" };
const SC_SKILL = { 0:"Обычная атака", 1:"Особая атака", 2:"Уклонение", 3:"Цепная атака", 5:"Базовый навык", 6:"Поддержка" };

/* ── расчёт характеристик по формулам из документации Enka ── */
function scVal(map, id){ return map[id] || 0; }
function scWeaponMain(v, lvl, brk){ return Math.floor(v * (1 + 0.1568166666666667 * lvl + 0.8922 * brk)); }
function scWeaponSub(v, brk){ return Math.floor(v * (1 + 0.3 * brk)); }
function scDiscMain(v, lvl, rar){ const k = { 4:.2, 3:.25, 2:.3 }[rar] || .2; return Math.floor(v + v * lvl * k); }
function scList(x){
  if(Array.isArray(x)) return x;
  if(x && typeof x === "object") return Object.keys(x).map(k => typeof x[k] === "object" ? x[k] : { Index:Number(k), Level:x[k] });
  return [];
}

function scCompute(av){
  const B = sbuild, info = B.avatars[String(av.Id)] || {};
  const lvl = av.Level || 1, promo = Math.max(0, (av.PromotionLevel || 1) - 1), core = av.CoreSkillEnhancement || 0;
  const base = {};
  Object.keys(info.base || {}).forEach(p => {
    const g = Math.floor(((info.grow || {})[p] || 0) * (lvl - 1) / 10000);
    const pr = ((info.promo || [])[promo] || {})[p] || 0;
    const co = ((info.core || [])[core] || {})[p] || 0;
    base[p] = info.base[p] + g + pr + co;
  });
  const add = {};                                   // всё, что сверху: оружие, диски, комплекты
  const put = (pid, v) => { pid = String(pid); add[pid] = (add[pid] || 0) + v; };
  // амплификатор
  const w = av.Weapon, wi = w && B.weapons[String(w.Id)];
  let weapon = null;
  if(w && wi){
    const main = wi.main ? scWeaponMain(wi.main[1], w.Level || 1, w.BreakLevel || 0) : 0;
    const sub = wi.sub ? scWeaponSub(wi.sub[1], w.BreakLevel || 0) : 0;
    if(wi.main) base[wi.main[0]] = (base[wi.main[0]] || 0) + main;    // базовая атака амплификатора
    if(wi.sub) put(wi.sub[0], sub);
    weapon = { id:String(w.Id), lvl:w.Level || 1, phase:w.UpgradeLevel || 1, brk:w.BreakLevel || 0, r:wi.r, img:wi.img,
      main: wi.main ? [wi.main[0], main] : null, sub: wi.sub ? [wi.sub[0], sub] : null };
  }
  // диски
  const discs = [], suitCount = {};
  scList(av.EquippedList).forEach(slot => {
    const e = slot.Equipment || slot;
    const di = B.discs[String(e.Id)] || [4, ""];
    const rar = di[0], suit = di[1];
    suitCount[suit] = (suitCount[suit] || 0) + 1;
    const mains = scList(e.MainStatList).map(m => [String(m.PropertyId), scDiscMain(m.PropertyValue || 0, e.Level || 0, rar)]);
    const subs = scList(e.RandomPropertyList).map(m => [String(m.PropertyId), (m.PropertyValue || 0) * (m.PropertyLevel || 1), m.PropertyLevel || 1]);
    mains.forEach(m => put(m[0], m[1]));
    subs.forEach(m => put(m[0], m[1]));
    discs.push({ slot: slot.Slot || e.Slot || discs.length + 1, lvl: e.Level || 0, rar, suit, main: mains[0] || null, subs });
  });
  discs.sort((a, b) => a.slot - b.slot);
  const sets = Object.keys(suitCount).filter(s => s && suitCount[s] >= 2).map(s => ({ id:s, n:suitCount[s] }))
    .sort((a, b) => b.n - a.n);
  sets.forEach(s => { const su = B.suits[s.id]; if(su) Object.keys(su.bonus || {}).forEach(p => put(p, su.bonus[p])); });

  // итог: база × (1 + %) + плоское
  const pct = (b, r, f) => Math.floor((base[b] || 0) * (1 + (add[r] || 0) / 10000) + (add[f] || 0));
  const flat = (b, f) => (base[b] || 0) + (add[f] || 0);
  const total = {
    hp: pct("11101", "11102", "11103"), atk: pct("12101", "12102", "12103"), def: pct("13101", "13102", "13103"),
    impact: pct("12201", "12202", "12203"), crit: flat("20101", "20103"), critdmg: flat("21101", "21103"),
    am: pct("31401", "31402", "31403"), ap: flat("31201", "31203"), penr: flat("23101", "23103"), pen: flat("23201", "23203"),
    er: Math.round(((base["30501"] || 0) * (1 + (add["30502"] || 0) / 10000) + (add["30503"] || 0))),
    dmg: {}
  };
  ["31501","31601","31701","31801","31901"].forEach(b => { const v = flat(b, String(Number(b) + 2)); if(v) total.dmg[b] = v; });
  const skills = scList(av.SkillLevelList).map(s => ({ i:s.Index, lv:(s.Level || 0) + ((av.TalentLevel || 0) >= 5 ? 4 : (av.TalentLevel || 0) >= 3 ? 2 : 0) }))
    .filter(s => SC_SKILL[s.i] !== undefined).sort((a, b) => a.i - b.i);
  return { info, lvl, m: av.TalentLevel || 0, core, base, add, total, weapon, discs, sets, skills };
}

function scPropName(pid){
  const p = sbuild && sbuild.props[String(pid)];
  if(!p) return "#" + pid;
  // «Процент HP» и «HP» в игре показываются одинаково — «HP» и значение в процентах
  let key = p.k.replace(/_Ratio$|_base$|_Base$/, "");
  const all = sbuild.props;
  const same = Object.values(all).find(x => x.k === key && x.n);
  const nm = nameLang() === "en" ? ((same && same.en) || p.en) : ((same && same.n) || p.n);
  return nm || p.k;
}
function scPropVal(pid, v){
  const p = sbuild && sbuild.props[String(pid)];
  const f = p ? p.f : "";
  if(f.indexOf("%") !== -1) return (Math.round(v / 10) / 10).toLocaleString("ru-RU") + "%";
  if(/^305/.test(String(pid))) return (v / 100).toLocaleString("ru-RU", { maximumFractionDigits:2 });
  return Math.floor(v).toLocaleString("ru-RU");
}
function scName(kind, id){
  const db = itemsDb.nap;
  const it = db && db.items[String(id)];
  if(it) return dbName(it);
  if(kind === "suit"){ const s = sbuild && sbuild.suits[String(id)]; return s ? (nameLang() === "en" ? s.en || s.n : s.n || s.en) : "#" + id; }
  return "#" + id;
}

/* ── загрузка ── */
function scUid(){
  const inp = document.getElementById("scUid");
  return (inp && inp.value || "").replace(/\D/g, "");
}
function scUrl(uid){
  const base = (ui.enkaProxy || "https://enka.network").replace(/\/+$/, "");
  return base + "/api/zzz/uid/" + uid;
}
function scIngest(j, uidHint){
  const pi = j.PlayerInfo || j.playerInfo || {};
  const list = ((pi.ShowcaseDetail || {}).AvatarList) || [];
  const prof = ((pi.SocialDetail || {}).ProfileDetail) || {};
  const uid = String(j.uid || prof.Uid || uidHint || "");
  if(!uid) throw new Error("В файле нет UID — это не похоже на ответ Enka для ZZZ.");
  const now = new Date().toISOString();
  const u = enkaData[uid] = enkaData[uid] || { agents:{} };
  u.nick = prof.Nickname || u.nick || "";
  u.level = prof.Level || u.level || 0;
  u.at = now;
  u.shown = list.map(a => String(a.Id));
  list.forEach(a => { u.agents[String(a.Id)] = { at: now, a }; });
  ui.scUid = uid;
  if(list.length && !u.agents[ui.scAgent]) ui.scAgent = String(list[0].Id);
  saveUI(); enkaSave();
  return { uid, n: list.length };
}
async function scFetch(){
  const uid = scUid();
  const note = document.getElementById("scNote");
  const help = document.getElementById("scHelp");
  if(uid.length < 8){ note.textContent = "Введите UID — 8–10 цифр."; return; }
  const btn = document.getElementById("scLoad");
  btn.disabled = true; btn.textContent = "Загружаю…";
  help.classList.add("hidden");
  try {
    const r = await fetch(scUrl(uid), { cache:"no-store" });
    if(r.status === 404){ note.textContent = "Игрок с таким UID не найден."; return; }
    if(r.status === 424){ note.textContent = "Enka сейчас недоступна: в игре техработы или вышло обновление. Попробуйте позже."; return; }
    if(r.status === 429){ note.textContent = "Слишком часто — Enka просит подождать пару минут."; return; }
    if(!r.ok){ note.textContent = "Enka ответила ошибкой " + r.status + "."; return; }
    const res = scIngest(await r.json(), uid);
    note.textContent = res.n ? "Загружено агентов из витрины: " + res.n + "." : "Витрина профиля пуста — выставьте агентов в профиле игры.";
    renderShowcase();
  } catch(e){
    // браузер не пускает запрос на чужой сайт (CORS) или нет сети
    note.textContent = "Браузер не смог получить данные напрямую.";
    document.getElementById("scHelpLink").href = "https://enka.network/api/zzz/uid/" + uid;
    help.classList.remove("hidden");
  } finally {
    btn.disabled = false; btn.textContent = "Обновить из витрины";
  }
}
function scFile(f){
  const rd = new FileReader();
  rd.onload = () => {
    const note = document.getElementById("scNote");
    try {
      const res = scIngest(JSON.parse(rd.result), scUid());
      note.textContent = "Из файла загружено агентов: " + res.n + ".";
      document.getElementById("scHelp").classList.add("hidden");
      renderShowcase();
    } catch(e){ note.textContent = e.message || "Не удалось прочитать файл."; }
  };
  rd.readAsText(f);
}

/* ── отрисовка ── */
function scImg(path){ return path ? ENKA_HOST + path : ""; }
function renderShowcase(){
  document.getElementById("hTitle").childNodes[0].nodeValue = "Витрина";
  const accUid = (hdata.accounts.find(a => a.game === "nap" && a.key === hdata.active) || hdata.accounts.find(a => a.game === "nap") || {}).uid;
  const inp = document.getElementById("scUid");
  if(!inp.value) inp.value = ui.scUid || accUid || "";
  const uid = scUid();
  const u = enkaData[uid];
  document.getElementById("hSub").textContent = "Zenless Zone Zero" + (u && u.nick ? " · " + u.nick + (u.level ? ", ур. " + u.level : "") : "");
  if(!sbuild || !itemsDb.nap){ ensureBuild(() => ensureItems("nap", renderShowcase)); ensureItems("nap"); return; }

  const tabs = document.getElementById("scTabs"), card = document.getElementById("scCard");
  tabs.innerHTML = ""; card.innerHTML = "";
  if(!u || !Object.keys(u.agents).length){
    card.innerHTML = '<div class="sc-empty">Здесь появятся сборки агентов из витрины вашего профиля: амплификатор, диски и итоговые характеристики. ' +
      'Введите UID и нажмите «Обновить из витрины». В игре агенты должны быть выставлены в витрину профиля.</div>';
    return;
  }
  const ids = Object.keys(u.agents).sort((a, b) => {
    const sa = (u.shown || []).indexOf(a), sb = (u.shown || []).indexOf(b);
    if((sa === -1) !== (sb === -1)) return sa === -1 ? 1 : -1;
    if(sa !== sb) return sa - sb;
    return (u.agents[b].at || "").localeCompare(u.agents[a].at || "");
  });
  if(!u.agents[ui.scAgent]) ui.scAgent = ids[0];
  ids.forEach(id => {
    const b = document.createElement("button");
    const inShow = (u.shown || []).indexOf(id) !== -1;
    b.className = "sc-tab" + (id === ui.scAgent ? " on" : "") + (inShow ? "" : " old");
    b.style.setProperty("--accent", scElement((sbuild.avatars[id] || {}).el).c);
    b.title = scName("c", id) + (inShow ? "" : " — сейчас не в витрине, сборка от " + u.agents[id].at.slice(0, 10).split("-").reverse().join("."));
    const info = sbuild.avatars[id] || {};
    b.innerHTML = '<span>' + esc(scName("c", id).charAt(0)) + '</span>' + ((info.circle || info.img) ? '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(scImg(info.circle || info.img)) + '" onerror="this.remove()">' : "");
    b.onclick = () => { ui.scAgent = id; saveUI(); renderShowcase(); };
    tabs.appendChild(b);
  });
  scRenderCard(card, u, ui.scAgent);
}

// ценные дополнительные характеристики: крит всегда, остальное — по главным характеристикам агента
function scValuable(hl){
  const v = { "20103":1, "21103":1 };
  hl.forEach(p => {
    if(p === "12101") { v["12102"] = 1; }
    if(p === "11101") { v["11102"] = 1; }
    if(p === "13101") { v["13102"] = 1; }
    if(p === "31201" || p === "31401") { v["31203"] = 1; }
    if(p === "23101" || p === "23201") { v["23203"] = 1; }
    if(p === "12201") { v["12102"] = 1; }
  });
  return v;
}
function scPips(n, max, cls){
  let h = '<span class="sc-pips ' + (cls || "") + '">';
  for(let i = 1; i <= max; i++) h += '<i class="' + (i <= n ? "on" : "") + '"></i>';
  return h + "</span>";
}
function scRenderCard(card, u, id){
  const rec = u.agents[id], av = rec.a, c = scCompute(av), info = c.info;
  const inShow = (u.shown || []).indexOf(id) !== -1;
  const elem = scElement(info.el);
  const accent = elem.c;
  const hl = (info.hl || []).map(String);
  const valuable = scValuable(hl);
  const nm = scName("c", id);

  // критовая ценность дисков: 2 × шанс + урон, по доп. характеристикам
  let cv = 0;
  c.discs.forEach(d => d.subs.forEach(s => { if(s[0] === "20103") cv += 2 * s[1]; if(s[0] === "21103") cv += s[1]; }));

  const ru = nameLang() !== "en";
  const key = [["ATK", scPropName("12101"), c.total.atk, "12103"], ["CRIT", ru ? "Шанс крита" : "CRIT Rate", c.total.crit, "20103"], ["CDMG", scPropName("21103"), c.total.critdmg, "21103"]];
  if(hl.indexOf("31401") !== -1 || hl.indexOf("31201") !== -1) key[0] = ["AP", scPropName("31203"), c.total.ap, "31203"];
  if(hl.indexOf("12201") !== -1) key[0] = ["IMP", scPropName("12201"), c.total.impact, "12203"];
  const rows = [
    ["11101", "HP", c.total.hp, "11103"], ["12101", scPropName("12101"), c.total.atk, "12103"], ["13101", scPropName("13101"), c.total.def, "13103"],
    ["12201", scPropName("12201"), c.total.impact, "12203"], ["20101", scPropName("20103"), c.total.crit, "20103"], ["21101", scPropName("21103"), c.total.critdmg, "21103"],
    ["31401", scPropName("31401"), c.total.am, "31403"], ["31201", scPropName("31203"), c.total.ap, "31203"], ["23101", scPropName("23103"), c.total.penr, "23103"],
    ["23201", scPropName("23203"), c.total.pen, "23203"], ["30501", scPropName("30503"), c.total.er, "30503"]
  ].concat(Object.keys(c.total.dmg).map(b => [b, scPropName(b), c.total.dmg[b], String(Number(b) + 2)]));

  let h = '<div class="sc-hero" style="--accent:' + esc(accent) + '">' +
    '<div class="sc-art">' +
      '<span class="sc-art-letter"' + (info.img ? ' hidden' : "") + '>' + esc(nm.charAt(0)) + '</span>' +
      (info.img ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(info.img)) + '" onerror="this.previousElementSibling.hidden=false;this.remove()">' : "") +
    '</div>' +
    '<div class="sc-head">' +
      '<div class="sc-chips"><span class="sc-el"><i></i>' + esc(elem.n) + '</span>' + (info.pro ? '<span>' + esc(SC_PRO[info.pro] || info.pro) + '</span>' : "") + '</div>' +
      '<h2>' + esc(nm) + '</h2>' +
      '<div class="sc-lvl"><span class="num">Ур. ' + c.lvl + '</span><div class="sc-lvlbar"><i style="width:' + Math.min(100, c.lvl / 60 * 100) + '%"></i></div><small>60</small></div>' +
      '<div class="sc-mind" title="Кинограмма M' + c.m + '">' + [1,2,3,4,5,6].map(i => '<i class="' + (i <= c.m ? "on" : "") + '">' + i + '</i>').join("") + '<b>M' + c.m + '</b></div>' +
      '<div class="sc-keys">' + key.map(k => '<div><span>' + esc(k[1]) + '</span><b class="num">' + esc(scPropVal(k[3], k[2])) + '</b></div>').join("") + '</div>' +
      '<div class="sc-skills">' + c.skills.map(s => '<span title="' + esc(SC_SKILL[s.i]) + ': ' + s.lv + '"><i>' + esc(SC_SKILL[s.i]) + '</i><b>' + s.lv + '</b></span>').join("") +
        '<span title="Открытые улучшения базового навыка"><i>Ядро</i><b>' + (c.core ? "ABCDEF".slice(0, c.core).slice(-1) : "—") + '</b></span></div>' +
      '<p class="sc-when">' + (inShow ? "В витрине сейчас" : "Сборка от " + rec.at.slice(0, 10).split("-").reverse().join(".") + ", сейчас не в витрине") +
        ' · обновлено ' + new Date(u.at).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) + '</p>' +
    '</div></div>';

  // характеристики + амплификатор и комплекты
  h += '<div class="sc-cols"><div class="sc-panel"><div class="sc-ptitle">Характеристики</div><div class="sc-stats">' + rows.map(r => {
      const add = r[2] - (c.base[r[0]] || 0);
      const showAdd = /^(11101|12101|13101|12201|31401)$/.test(r[0]) && add > 0;
      return '<div class="sc-stat' + (hl.indexOf(r[0]) !== -1 ? " hl" : "") + '"><span>' + esc(r[1]) + '</span><b class="num">' + esc(scPropVal(r[3], r[2])) +
        (showAdd ? '<small>' + esc(scPropVal(r[3], c.base[r[0]] || 0)) + ' <em>+' + esc(scPropVal(r[3], add)) + '</em></small>' : "") + '</b></div>';
    }).join("") + '</div></div>';

  h += '<div class="sc-side">';
  if(c.weapon){
    const w = c.weapon;
    h += '<div class="sc-panel sc-weapon r' + w.r + '"><div class="sc-ptitle">Амплификатор</div><div class="sc-wbody">' +
      '<div class="sc-wimg"><span>' + (w.r === 4 ? "S" : w.r === 3 ? "A" : "B") + '</span>' + (w.img ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(w.img)) + '" onerror="this.remove()">' : "") + '</div>' +
      '<div class="sc-winfo"><div class="sc-wname">' + esc(scName("w", w.id)) + '</div>' +
      '<div class="sc-wmeta"><span>Ур. ' + w.lvl + '</span>' + scPips(w.phase, 5, "p") + '<b>P' + w.phase + '</b></div>' +
      (w.main ? '<div class="sc-wstat"><span>' + esc(scPropName(w.main[0])) + '</span><b class="num">' + esc(scPropVal(w.main[0], w.main[1])) + '</b></div>' : "") +
      (w.sub ? '<div class="sc-wstat"><span>' + esc(scPropName(w.sub[0])) + '</span><b class="num">' + esc(scPropVal(w.sub[0], w.sub[1])) + '</b></div>' : "") +
      '</div></div></div>';
  } else h += '<div class="sc-panel sc-weapon none"><div class="sc-ptitle">Амплификатор</div>Не экипирован</div>';
  h += '<div class="sc-panel"><div class="sc-ptitle">Комплекты</div>' + (c.sets.length ? '<div class="sc-sets">' + c.sets.map(s => {
      const su = sbuild.suits[s.id] || {};
      return '<div class="sc-set' + (s.n >= 4 ? " full" : "") + '">' + (su.icon ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(su.icon)) + '" onerror="this.remove()">' : '<i></i>') +
        '<span>' + esc(scName("suit", s.id)) + '</span><b>' + (s.n >= 4 ? "4" : "2") + '</b></div>';
    }).join("") + '</div>' : '<p class="sc-none">Нет собранных комплектов</p>') +
    '<div class="sc-cv"><span>Крит. ценность дисков</span><b class="num">' + (Math.round(cv / 10) / 10).toLocaleString("ru-RU") + '</b></div></div>';
  h += '</div></div>';

  // диски
  h += '<div class="sc-ptitle sc-dtitle">Диски</div><div class="sc-discs">';
  for(let slot = 1; slot <= 6; slot++){
    const d = c.discs.find(x => x.slot === slot);
    if(!d){ h += '<div class="sc-disc none"><em class="sc-slot">' + slot + '</em><p>Пусто</p></div>'; continue; }
    const su = sbuild.suits[d.suit] || {};
    h += '<div class="sc-disc r' + d.rar + '">' +
      (su.icon ? '<img class="sc-dmark" alt="" referrerpolicy="no-referrer" src="' + esc(scImg(su.icon)) + '" onerror="this.remove()">' : "") +
      '<div class="sc-dhead"><em class="sc-slot">' + slot + '</em><span>' + esc(scName("suit", d.suit)) + '</span><i>+' + d.lvl + '</i></div>' +
      (d.main ? '<div class="sc-dmain"><span>' + esc(scPropName(d.main[0])) + '</span><b class="num">' + esc(scPropVal(d.main[0], d.main[1])) + '</b></div>' : "") +
      '<div class="sc-dsubs">' + d.subs.map(s => '<div class="sc-dsub' + (valuable[s[0]] ? " val" : "") + '"><span>' + esc(scPropName(s[0])) +
        '</span>' + (s[2] > 1 ? '<i title="Усилений: ' + (s[2] - 1) + '">' + "•".repeat(Math.min(5, s[2] - 1)) + '</i>' : "<i></i>") +
        '<b class="num">' + esc(scPropVal(s[0], s[1])) + '</b></div>').join("") + '</div></div>';
  }
  h += '</div><p class="hint sc-foot">Характеристики посчитаны по формулам Enka: агент, амплификатор, диски и бонусы комплектов за 2 предмета. Пассивки амплификатора, эффекты за 4 предмета и баффы в бою не учитываются, поэтому цифры могут немного отличаться от окна агента в игре. Точки у характеристик диска — сколько раз она усиливалась; золотом — полезные этому агенту.</p>';
  card.innerHTML = h;
}

document.getElementById("scLoad").onclick = scFetch;
document.getElementById("scUid").addEventListener("keydown", e => { if(e.key === "Enter") scFetch(); });
document.getElementById("scPick").onclick = () => document.getElementById("scFile").click();
document.getElementById("scFile").onchange = e => { const f = e.target.files[0]; if(f) scFile(f); e.target.value = ""; };

/* адрес посредника в настройках */
(function(){
  const inp = document.getElementById("enkaProxy");
  inp.value = ui.enkaProxy || "";
  document.getElementById("openSettings").addEventListener("click", () => { inp.value = ui.enkaProxy || ""; });
  inp.addEventListener("change", () => {
    const v = inp.value.trim().replace(/\/+$/, "");
    if(v && !/^https:\/\//.test(v)){ inp.value = ui.enkaProxy || ""; return; }
    if(v) ui.enkaProxy = v; else delete ui.enkaProxy;
    saveUI();
  });
})();
