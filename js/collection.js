"use strict";
/* ── коллекция: какие персонажи и оружие получены, сколько копий и когда ──
   Копии из истории круток считаются сами; то, чего в истории нет (выпало до выгрузки,
   получено за события или в магазине), добавляется вручную и хранится вместе с историей. */

const COL_UNIT = {
  hk4e:  { c:"C", w:"R", cName:"созвездие", wName:"пробуждение" },
  hkrpg: { c:"E", w:"S", cName:"эйдолон",   wName:"наложение" },
  nap:   { c:"M", w:"",  cName:"кинограмма", wName:"копии" }
};
const COL_KIND = { hk4e:["Персонажи","Оружие"], hkrpg:["Персонажи","Конусы"], nap:["Агенты","Амплификаторы"] };
const COL_ONE = { hk4e:["персонаж","оружие"], hkrpg:["персонаж","световой конус"], nap:["агент","амплификатор"] };
const CS = { kind:"c", rank:"top", own:"all", q:"" };

function colGame(){ return histGameKey(); }
function colAcc(){ return HA(); }
// ручные копии: у аккаунта, а если истории ещё нет — у игры
function colStoreKey(game, acc){ return acc ? acc.key : game; }
function colOwn(game, acc){
  hdata.own = hdata.own || {};
  return hdata.own[colStoreKey(game, acc)] || {};
}
function colSetOwn(game, acc, id, v){
  hdata.own = hdata.own || {};
  const k = colStoreKey(game, acc);
  const o = hdata.own[k] = hdata.own[k] || {};
  if(!v || (!v.n && !v.d)) delete o[id]; else o[id] = v;
  if(!Object.keys(o).length) delete hdata.own[k];
  hSave();
}
function rankLabel(game, r){
  if(game === "nap") return r === "4" ? "S" : r === "3" ? "A" : "B";
  return r + "★";
}
function itemKindOf(game, id, rec){
  const it = itemsDb[game] && itemsDb[game].items[id];
  if(it) return it.t;
  if(!rec) return "";
  if(typeRu(rec.y) === "Банбу") return "";
  return iconKind(rec) === "char" ? "c" : "w";
}

/* сводка по предметам: из истории + ручные копии + каталог базы */
function colItems(game, acc){
  const db = itemsDb[game];
  const g = gameInfo(game);
  const ranks = [g.top, g.mid];
  const map = {};
  const get = (id, rec) => {
    if(!map[id]){
      const it = db && db.items[id];
      map[id] = { id, name: it ? it.n : (rec ? rec.n : id), en: it ? it.en : "", r: it ? String(it.r) : (rec ? rec.r : ""),
        t: itemKindOf(game, id, rec), icon: it ? it.i : "", hist: [], extra: 0, extraDate: "" };
    }
    return map[id];
  };
  if(acc){
    acc.records.forEach(r => {
      if(ranks.indexOf(r.r) === -1) return;
      const id = recItemId(game, r) || "n:" + normName(r.n);
      const x = get(id, r);
      if(!x.t) return;
      x.hist.push(r);
    });
  }
  const own = colOwn(game, acc);
  Object.keys(own).forEach(id => { const x = get(id, null); x.extra = own[id].n || 0; x.extraDate = own[id].d || ""; });
  if(db) Object.keys(db.items).forEach(id => { if(ranks.indexOf(String(db.items[id].r)) !== -1) get(id, null); });
  return Object.values(map).filter(x => x.t === "c" || x.t === "w").map(x => {
    x.hist.sort(byId);
    x.copies = x.hist.length + x.extra;
    const dates = x.hist.map(r => (r.t || "").slice(0, 10)).filter(Boolean);
    if(x.extraDate && x.extra) dates.push(x.extraDate);
    dates.sort();
    x.first = dates[0] || "";
    x.last = x.hist.length ? (x.hist[x.hist.length - 1].t || "").slice(0, 10) : (x.extra ? x.extraDate : "");
    return x;
  });
}
// уровень копий: C0–C6 у персонажей, R1–R5 у оружия; лишние копии — «+N»
function colLevel(game, x){
  if(!x.copies) return "";
  const u = COL_UNIT[game] || COL_UNIT.hk4e;
  if(x.t === "c"){
    const c = Math.min(6, x.copies - 1), over = x.copies - 1 - c;
    return u.c + c + (over > 0 ? " +" + over : "");
  }
  if(!u.w) return "×" + x.copies;
  const w = Math.min(5, x.copies), over = x.copies - w;
  return u.w + w + (over > 0 ? " +" + over : "");
}
function colMaxed(x){ return x.t === "c" ? x.copies >= 7 : x.copies >= 5; }

function colSeg(id, items, cur, set){
  const el = document.getElementById(id);
  el.innerHTML = "";
  items.forEach(([v, label]) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = v === cur ? "on" : "";
    b.onclick = () => { set(v); renderCollection(); };
    el.appendChild(b);
  });
}

function colPic(el, game, x){
  el.innerHTML = '<span>' + esc((x.name || "?").charAt(0).toUpperCase()) + '</span>';
  if(iconMode() === "off") return;
  const urls = [];
  if(x.icon) urls.push(ENKA_HOST + x.icon);
  if(x.hist.length && typeof iconList === "function"){
    const r = x.hist[0];
    iconList(game, r).forEach(t => urls.push(t.replace(/\{id\}/g, r.i).replace(/\{game\}/g, game)));
  }
  if(!urls.length) return;
  const img = document.createElement("img");
  img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
  let i = 0;
  img.onerror = () => { i++; if(i < urls.length) img.src = urls[i]; else img.remove(); };
  img.src = urls[0];
  el.appendChild(img);
}

function renderCollection(){
  const game = colGame();
  const acc = colAcc();
  document.getElementById("hTitle").childNodes[0].nodeValue = "Коллекция";
  document.getElementById("hSub").textContent = gameInfo(game).name + (acc ? " · UID " + acc.uid : "");
  if(!itemsDb[game]) ensureItems(game, () => { if(document.body.classList.contains("tab-collection")) renderCollection(); });

  // аккаунты
  const box = document.getElementById("colAccounts");
  const mine = hdata.accounts.filter(a => a.game === game);
  box.innerHTML = "";
  box.classList.toggle("hidden", mine.length < 2);
  mine.forEach(a => {
    const b = document.createElement("button");
    b.className = "chip" + (acc && a.key === acc.key ? " on" : "");
    b.textContent = "UID " + a.uid;
    b.onclick = () => { hdata.active = a.key; hSave(); renderCollection(); };
    box.appendChild(b);
  });

  const g = gameInfo(game);
  const all = colItems(game, acc);
  const kinds = COL_KIND[game] || COL_KIND.hk4e;

  // итоги: сколько получено из известных базе
  const tot = document.getElementById("colTotals");
  const cell = (t, r, label) => {
    const part = all.filter(x => x.t === t && x.r === r);
    const got = part.filter(x => x.copies).length;
    return '<div class="tot' + (r === g.top ? " gold" : "") + '"><div class="k">' + label + '</div><div class="v num">' + got +
      '<small> из ' + part.length + '</small></div></div>';
  };
  tot.innerHTML = cell("c", g.top, kinds[0] + " " + rankLabel(game, g.top)) + cell("c", g.mid, kinds[0] + " " + rankLabel(game, g.mid)) +
    cell("w", g.top, kinds[1] + " " + rankLabel(game, g.top)) + cell("w", g.mid, kinds[1] + " " + rankLabel(game, g.mid));

  colSeg("colKind", [["c", kinds[0]], ["w", kinds[1]]], CS.kind, v => CS.kind = v);
  colSeg("colRank", [["top", rankLabel(game, g.top)], ["mid", rankLabel(game, g.mid)], ["all", "все"]], CS.rank, v => CS.rank = v);
  colSeg("colOwn", [["all", "все"], ["yes", "есть"], ["no", "нет"]], CS.own, v => CS.own = v);
  const sortSel = document.getElementById("colSort");
  sortSel.value = ui.colSort || "date";

  const q = normName(CS.q);
  let list = all.filter(x => x.t === CS.kind &&
    (CS.rank === "all" || x.r === (CS.rank === "top" ? g.top : g.mid)) &&
    (CS.own === "all" || (CS.own === "yes") === (x.copies > 0)) &&
    (!q || normName(x.name).indexOf(q) !== -1 || normName(x.en).indexOf(q) !== -1));
  const sort = ui.colSort || "date";
  list.sort((a, b) => {
    if(!!a.copies !== !!b.copies) return a.copies ? -1 : 1;           // полученные — первыми
    if(b.r !== a.r) return Number(b.r) - Number(a.r);
    if(sort === "copies" && a.copies !== b.copies) return b.copies - a.copies;
    if(sort === "date" && a.copies && (a.last || "") !== (b.last || "")) return (b.last || "").localeCompare(a.last || "");
    if(sort !== "name" && !a.copies && a.id.length === b.id.length && a.id !== b.id) return a.id < b.id ? 1 : -1;  // новее — выше
    return a.name.localeCompare(b.name, "ru");
  });

  const grid = document.getElementById("colGrid");
  grid.innerHTML = "";
  list.forEach(x => {
    const c = document.createElement("button");
    c.className = "colcard" + (x.copies ? "" : " none") + (x.r === g.top ? " top" : "") + (colMaxed(x) ? " max" : "");
    const pic = document.createElement("div");
    pic.className = "colpic";
    colPic(pic, game, x);
    c.appendChild(pic);
    const lvl = colLevel(game, x);
    if(lvl){
      const b = document.createElement("i");
      b.className = "lvl"; b.textContent = lvl;
      c.appendChild(b);
    }
    const nm = document.createElement("div");
    nm.className = "nm"; nm.textContent = x.name;
    c.appendChild(nm);
    const sub = document.createElement("div");
    sub.className = "sb";
    sub.textContent = x.copies ? (x.first ? "с " + x.first.split("-").reverse().join(".") : "дата неизвестна") : "нет";
    c.appendChild(sub);
    c.onclick = () => openColItem(game, acc, x.id);
    grid.appendChild(c);
  });

  const note = document.getElementById("colNote");
  const extra = all.filter(x => x.extra).length;
  note.textContent = !itemsDb[game] ? "Загружаю базу персонажей…"
    : (acc ? "" : "История круток не загружена — копии можно отметить вручную. ") +
      (list.length ? "" : "Ничего не найдено. ") +
      (extra ? "Вручную добавлены копии у " + extra + " " + (extra % 10 === 1 && extra % 100 !== 11 ? "предмета" : "предметов") + ". " : "") +
      "Нажмите на карточку, чтобы посмотреть, когда выпадали копии, или добавить полученные вне истории.";
}
document.getElementById("colSort").onchange = e => { ui.colSort = e.target.value; saveUI(); renderCollection(); };
document.getElementById("colSearch").addEventListener("input", e => { CS.q = e.target.value; renderCollection(); });

/* ── карточка предмета ── */
let colCur = null;
function openColItem(game, acc, id){
  colCur = { game, acc, id };
  document.getElementById("colOverlay").classList.add("on");
  renderColItem();
}
function renderColItem(){
  const { game, acc, id } = colCur;
  const x = colItems(game, acc).find(i => i.id === id);
  if(!x){ closeColItem(); return; }
  const u = COL_UNIT[game] || COL_UNIT.hk4e;
  colPic(document.getElementById("colItemPic"), game, x);
  document.getElementById("colItemName").textContent = x.name;
  document.getElementById("colItemSub").textContent = rankLabel(game, x.r) + " · " + (COL_ONE[game] || COL_ONE.hk4e)[x.t === "c" ? 0 : 1] +
    (x.en && x.en !== x.name ? " · " + x.en : "");
  const lvl = colLevel(game, x);
  document.getElementById("colItemLevel").innerHTML = x.copies
    ? '<b class="num">' + esc(lvl) + '</b><span>' + x.copies + " " + (x.copies % 10 === 1 && x.copies % 100 !== 11 ? "копия" : x.copies % 10 >= 2 && x.copies % 10 <= 4 && (x.copies % 100 < 10 || x.copies % 100 >= 20) ? "копии" : "копий") +
      (x.hist.length && x.extra ? " — " + x.hist.length + " из истории, " + x.extra + " вне её" : x.extra ? " — все вне истории" : " — все из истории") +
      (x.first ? " · впервые " + x.first.split("-").reverse().join(".") : "") + '</span>'
    : '<span>Пока не получено.</span>';
  document.getElementById("colExtra").textContent = x.extra;
  document.getElementById("colMinus").disabled = !x.extra;
  document.getElementById("colExtraDate").value = x.extraDate || "";
  const ev = document.getElementById("colEvents");
  if(!x.hist.length){ ev.innerHTML = '<p class="hint" style="margin:0">В файле истории этого предмета нет.</p>'; return; }
  ev.innerHTML = x.hist.slice().reverse().map((r, i) => {
    const n = x.hist.length - i;
    const lv = x.t === "c" ? u.c + Math.min(6, n - 1 + x.extra) : (u.w ? u.w + Math.min(5, n + x.extra) : "×" + (n + x.extra));
    return '<div class="colev"><span class="d">' + esc((r.t || "").slice(0, 16).replace(/^(\d{4})-(\d\d)-(\d\d)/, "$3.$2.$1")) + '</span><span class="b">' +
      esc(bannerInfo(game, r.k).n) + '</span><i>' + esc(lv) + '</i></div>';
  }).join("");
}
function colChangeExtra(delta, date){
  const { game, acc, id } = colCur;
  const own = colOwn(game, acc)[id] || { n:0, d:"" };
  const v = { n: Math.max(0, (own.n || 0) + delta), d: date !== undefined ? date : (own.d || "") };
  colSetOwn(game, acc, id, v);
  renderColItem();
  renderCollection();
}
function closeColItem(){ document.getElementById("colOverlay").classList.remove("on"); }
document.getElementById("colPlus").onclick = () => colChangeExtra(1);
document.getElementById("colMinus").onclick = () => colChangeExtra(-1);
document.getElementById("colExtraDate").onchange = e => colChangeExtra(0, e.target.value || "");
document.getElementById("colClose").onclick = closeColItem;
document.getElementById("colOverlay").addEventListener("mousedown", e => { if(e.target.id === "colOverlay") closeColItem(); });
document.addEventListener("keydown", e => { if(e.key === "Escape" && document.getElementById("colOverlay").classList.contains("on")) closeColItem(); });
