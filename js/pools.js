"use strict";
/* ── пул проигрыша 50/50 и база персонажей ──
   Если ценное выпадение на ивентовом баннере — персонаж или оружие из пула проигрыша
   на эту дату, значит 50/50 (75/25) проигран; иначе выигран.
   Пул проигрыша = стандартный пул + добавленные в него лимитированные (в Star Rail с 3.2).
   Стандартный пул меняется редко (Тигнари — с 3.1), и всё, что в нём, выпадает и на
   стандартном баннере; добавленные лимитированные — только при проигрыше на ивентовом. */

// "" — с выхода игры; дата — с какого дня (по серверному времени)
const STD_POOL = {
  hk4e: {
    "10000003":"", "10000016":"", "10000041":"", "10000042":"", "10000035":"",   // Джинн, Дилюк, Мона, Кэ Цин, Ци Ци
    "10000069":"2022-09-28",                                                     // Тигнари — с 3.1
    "10000079":"2023-04-12",                                                     // Дэхья — с 3.6
    "10000109":"2025-03-26",                                                     // Мидзуки — с 5.5
    "11501":"", "11502":"", "12501":"", "12502":"", "13502":"",
    "13505":"", "14501":"", "14502":"", "15501":"", "15502":""                   // стандартное оружие
  },
  hkrpg: {
    "1003":"", "1004":"", "1101":"", "1104":"", "1107":"", "1209":"", "1211":"", // Химеко, Вельт, Броня, Гепард, Клара, Яньцин, Байлу
    "23000":"", "23002":"", "23003":"", "23004":"", "23005":"", "23012":"", "23013":""
  },
  nap: {
    "1181":"", "1101":"", "1021":"", "1211":"", "1041":"", "1141":"",           // Грейс, Коляда, Нэкомата, Рина, Солдат 11, Ликаон
    "14102":"", "14110":"", "14114":"", "14118":"", "14121":"", "14104":""
  }
};
// только пул проигрыша: в стандартный баннер не входят
const LOSE_EXTRA = {
  hkrpg: {
    // с 3.2 игрок выбирает 7 персонажей пула проигрыша из стандартных и добавленных лимитированных;
    // если такой персонаж выпал на собственном повторном баннере — отметьте выигрыш вручную
    "1102":"2025-04-09", "1205":"2025-04-09", "1208":"2025-04-09",              // Зеле, Блэйд, Фу Сюань — с 3.2
    "1006":"2026-04-22", "1302":"2026-04-22", "1221":"2026-04-22"               // Серебряный Волк, Аргенти, Юньли — с 4.2
  }
};
function basePool(game){
  const o = {};
  Object.keys(STD_POOL[game] || {}).forEach(id => { o[id] = { from: STD_POOL[game][id], std:true }; });
  Object.keys(LOSE_EXTRA[game] || {}).forEach(id => { o[id] = { from: LOSE_EXTRA[game][id], std:false }; });
  return o;
}
// где действует 50/50: ивентовые баннеры персонажей и оружия (у банбу свой пул — не трогаем)
const STD_ELIGIBLE = {
  hk4e:  { "301":1, "302":1 },
  hkrpg: { "11":1, "12":1, "21":1, "22":1 },
  nap:   { "2":1, "3":1 }
};
const STD_CHANNEL = { hk4e:"200", hkrpg:"1", nap:"1" };

/* база имён и иконок — items/data/<игра>.json, обновляется раз в неделю в GitHub Actions */
const itemsDb = {}, itemsWait = {}, itemsLoading = {};
function ensureItems(game, cb){
  if(itemsDb[game]){ if(cb) cb(itemsDb[game]); return itemsDb[game]; }
  if(cb) (itemsWait[game] = itemsWait[game] || []).push(cb);
  if(itemsLoading[game]) return null;
  itemsLoading[game] = true;
  fetch("items/data/" + game + ".json", { cache:"no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => {
      const db = { items: j.items || {}, updated: j.updated || "", byName: {}, fuzzy: {} };
      Object.keys(db.items).forEach(id => {
        const it = db.items[id];
        [it.n, it.en].forEach(n => { if(n) db.byName[normName(n)] = id; });
      });
      itemsDb[game] = db;
      Object.keys(stdCache).forEach(k => delete stdCache[k]);
      const w = itemsWait[game] || [];
      delete itemsWait[game];
      w.forEach(f => { try { f(db); } catch(e){ console.error(e); } });
    })
    .catch(() => {})
    .finally(() => { itemsLoading[game] = false; });
  return null;
}
function normName(n){ return String(n || "").replace(/\s+/g, " ").trim().toLowerCase(); }
// код предмета записи: item_id, а если выгрузчик его не записал — по имени через базу
function recItemId(game, r){
  if(r.i) return String(r.i);
  const db = itemsDb[game];
  if(!db) return "";
  const n = normName(r.n);
  if(db.byName[n]) return db.byName[n];
  // имена в игре и в базе иногда расходятся («Куки Синобу» и «Синобу») — ищем по целому слову
  if(db.fuzzy[n] !== undefined) return db.fuzzy[n];
  const hits = Object.keys(db.byName).filter(k => k.length >= 3 && (n.endsWith(" " + k) || n.startsWith(k + " ") || k.endsWith(" " + n) || k.startsWith(n + " ")));
  const ids = hits.map(k => db.byName[k]).filter((v, i, a) => a.indexOf(v) === i);
  return db.fuzzy[n] = ids.length === 1 ? ids[0] : "";
}
function itemName(game, id, fallback){
  const it = itemsDb[game] && itemsDb[game].items[id];
  return it ? it.n : (fallback || "предмет " + id);
}

/* итоговый пул: встроенный список + ваши правки + то, что вы сами получали на стандартном баннере */
function stdEdits(game){
  hdata.stdEdit = hdata.stdEdit || {};
  return hdata.stdEdit[game] || {};
}
const stdCache = {};
// правки: { id: null } — убрано, { id: {from, std} } — добавлено или изменено
function stdPool(game, noEdits){
  const accs = hdata.accounts.filter(a => a.game === game);
  const edits = noEdits ? {} : stdEdits(game);
  const sig = accs.map(a => a.key + ":" + a.records.length).join("|") + "|" + JSON.stringify(edits) + "|" + !!itemsDb[game];
  const ck = game + (noEdits ? ":base" : "");
  if(stdCache[ck] && stdCache[ck].sig === sig) return stdCache[ck].map;
  const map = {}, base = basePool(game);
  Object.keys(base).forEach(id => { map[id] = { from: base[id].from, std: base[id].std, src:"base" }; });
  // выпадение на стандартном баннере — доказательство, что предмет уже был в стандартном пуле
  const top = gameInfo(game).top, ch = STD_CHANNEL[game];
  accs.forEach(a => a.records.forEach(r => {
    if(r.k !== ch || r.r !== top) return;
    const id = recItemId(game, r) || "n:" + normName(r.n);
    const d = (r.t || "").slice(0, 10);
    const cur = map[id];
    if(!cur){ map[id] = { from: d, std:true, src:"seen" }; return; }
    cur.std = true;
    if(cur.from && d && d < cur.from){ cur.from = d; cur.src = cur.src === "base" ? "base+seen" : cur.src; }
  }));
  Object.keys(edits).forEach(id => {
    const e = edits[id];
    if(e === null) delete map[id];
    else if(e && typeof e === "object") map[id] = { from: e.from || "", std: !!e.std, src:"user" };
  });
  stdCache[ck] = { sig, map };
  return map;
}
function isStdAt(game, r, pool){
  const id = recItemId(game, r);
  const e = pool[id] || pool["n:" + normName(r.n)];
  if(!e) return false;
  return !e.from || (r.t || "").slice(0, 10) >= e.from;
}

/* режим разметки 50/50 у аккаунта: std — по пулу проигрыша (по умолчанию),
   win — неразмеченные считать выигрышем, manual — только ручные отметки */
function markMode(acc){
  if(acc.mark50) return acc.mark50;
  return "std";
}
const MARK_MODES = [
  { id:"std",    btn:"Авторазметка: по пулу проигрыша" },
  { id:"win",    btn:"Неразмеченные: выигрыш" },
  { id:"manual", btn:"Только ручная разметка" }
];

/* ── окно «Пул проигрыша» ── */
let stdGame = null;
function stdSetEdit(id, v){
  hdata.stdEdit = hdata.stdEdit || {};
  const e = hdata.stdEdit[stdGame] = hdata.stdEdit[stdGame] || {};
  const auto = stdPool(stdGame, true)[id];            // как было бы без ваших правок
  // правка, совпадающая с тем, что и так получилось бы, — не правка
  if(v === null ? !auto : (auto && auto.from === v.from && auto.std === v.std)) delete e[id];
  else e[id] = v;
  if(!Object.keys(e).length) delete hdata.stdEdit[stdGame];
  hSave();
  renderStd();
  if(document.body.classList.contains("tab-history")) renderHistory();
}
function stdKind(game, id){
  const it = itemsDb[game] && itemsDb[game].items[id];
  if(it) return it.t;
  if(id.indexOf("n:") === 0) return "?";
  return game === "hk4e" ? (id.length > 6 ? "c" : "w") : (id.length > 4 ? "w" : "c");
}
function renderStd(){
  const game = stdGame, db = itemsDb[game];
  const list = document.getElementById("stdList");
  const pool = stdPool(game), edits = stdEdits(game);
  const top = Number(gameInfo(game).top);
  document.getElementById("stdTitle").textContent = "Пул проигрыша 50/50 · " + gameInfo(game).name;
  document.getElementById("stdGameNote").textContent = game === "hkrpg"
    ? "В Star Rail с версии 3.2 при проигрыше 50/50 могут выпасть и лимитированные персонажи — с 3.2 это Зеле, Блэйд и Фу Сюань, с 4.2 — ещё Серебряный Волк, Аргенти и Юньли. Если добавятся новые — внесите их ниже в «только пул проигрыша» с датой, с которой они стали выпадать. Если такой персонаж выпал на своём же повторном баннере, отметьте выигрыш вручную — отметка применится ко всему баннеру."
    : "";
  // в списке — всё, что в пуле, плюс убранные вами (их можно вернуть)
  const ids = Object.keys(pool).concat(Object.keys(edits).filter(id => edits[id] === null && !pool[id]));
  const label = id => id.indexOf("n:") === 0 ? id.slice(2) : itemName(game, id);
  const autoMap = stdPool(game, true);
  const isStd = id => pool[id] ? pool[id].std : !!(autoMap[id] && autoMap[id].std);
  const cw = game === "nap" ? ["агенты", "амплификаторы"] : game === "hkrpg" ? ["персонажи", "световые конусы"] : ["персонажи", "оружие"];
  const groups = [
    [id => isStd(id) && stdKind(game, id) === "c", "Стандартный пул — " + cw[0]],
    [id => isStd(id) && stdKind(game, id) === "w", "Стандартный пул — " + cw[1]],
    [id => isStd(id) && stdKind(game, id) === "?", "Стандартный пул — прочее"],
    [id => !isStd(id), "Только пул проигрыша (в стандартный баннер не входят)"]
  ];
  list.innerHTML = "";
  const fold = (ui.stdFold || {})[game] || {};
  groups.forEach(([fit, title], gi) => {
    const part = ids.filter(fit).sort((a, b) => label(a).localeCompare(label(b), "ru"));
    if(!part.length) return;
    // разделы сворачиваются; что свёрнуто — запоминается для каждой игры
    const shut = !!fold[gi];
    const h = document.createElement("button");
    h.className = "stdgrp" + (shut ? " shut" : "");
    h.setAttribute("aria-expanded", !shut);
    h.innerHTML = '<span>' + esc(title) + '</span><em>' + part.length + '</em>';
    h.onclick = () => {
      ui.stdFold = ui.stdFold || {};
      const f = ui.stdFold[game] = ui.stdFold[game] || {};
      if(f[gi]) delete f[gi]; else f[gi] = 1;
      saveUI();
      renderStd();
    };
    list.appendChild(h);
    if(shut) return;
    part.forEach(id => {
      const e = pool[id], removed = !e;
      const row = document.createElement("div");
      row.className = "stdrow" + (removed ? " off" : "");
      const src = removed ? "убрано вами" : e.src === "user" ? "ваша правка" : e.src === "seen" ? "выпадал у вас на стандартном баннере" :
        e.src === "base+seen" ? "встроенный список, дата уточнена по вашей истории" : "встроенный список";
      row.innerHTML = '<div class="nm">' + esc(label(id)) + '<small class="' + (e && e.src === "user" || removed ? "user" : "") + '">' + src + '</small></div>';
      if(!removed){
        const d = document.createElement("input");
        d.type = "date"; d.value = e.from || "";
        d.title = "В пуле с этой даты; очистите — будет «с выхода игры»";
        d.onchange = () => stdSetEdit(id, { from: d.value || "", std: e.std });
        if(e.from) row.appendChild(d);
        else {
          // пустая дата в поле выглядит как «дд.мм.гггг» — понятнее написать словами
          const lb = document.createElement("button");
          lb.className = "ghost sm since"; lb.textContent = "с выхода игры";
          lb.title = "Нажмите, чтобы указать дату";
          lb.onclick = () => { lb.replaceWith(d); try { d.showPicker && d.showPicker(); } catch(err){} d.focus(); };
          row.appendChild(lb);
        }
      }
      const x = document.createElement("button");
      x.className = "x";
      x.textContent = removed ? "↺" : "×";
      x.title = removed ? "Вернуть" : "Убрать из пула";
      x.onclick = () => {
        if(removed){
          const e2 = hdata.stdEdit[game];
          delete e2[id];
          if(!Object.keys(e2).length) delete hdata.stdEdit[game];
          hSave(); renderStd();
          if(document.body.classList.contains("tab-history")) renderHistory();
        } else stdSetEdit(id, null);
      };
      row.appendChild(x);
      list.appendChild(row);
    });
  });
  // подсказки для добавления — ценные предметы; уже добавленные можно ввести снова, чтобы перенести
  const dl = document.getElementById("stdAddList");
  dl.innerHTML = "";
  if(db){
    Object.keys(db.items).filter(id => db.items[id].r === top).forEach(id => {
      const o = document.createElement("option");
      o.value = db.items[id].n;
      dl.appendChild(o);
    });
  }
  const n = Object.keys(edits).length;
  document.getElementById("stdReset").classList.toggle("hidden", !n);
  document.getElementById("stdNote").textContent = db
    ? "База персонажей и оружия обновлена " + (db.updated ? db.updated.split("-").reverse().join(".") : "недавно") + "." + (n ? " Ваших правок: " + n + "." : "")
    : "Загружаю базу персонажей…";
}
function openStd(game){
  stdGame = game;
  document.getElementById("stdOverlay").classList.add("on");
  document.getElementById("stdAddName").value = "";
  document.getElementById("stdAddDate").value = "";
  document.getElementById("stdAddKind").value = "lose";
  renderStd();
  ensureItems(game, () => { if(stdGame === game) renderStd(); });
}
function closeStd(){ document.getElementById("stdOverlay").classList.remove("on"); }
document.getElementById("stdPoolBtn").onclick = () => { const a = HA(); if(a) openStd(a.game); };
document.getElementById("stdClose").onclick = closeStd;
document.getElementById("stdOverlay").addEventListener("mousedown", e => { if(e.target.id === "stdOverlay") closeStd(); });
document.addEventListener("keydown", e => { if(e.key === "Escape" && document.getElementById("stdOverlay").classList.contains("on")) closeStd(); });
document.getElementById("stdReset").onclick = () => {
  if(hdata.stdEdit) delete hdata.stdEdit[stdGame];
  hSave(); renderStd();
  if(document.body.classList.contains("tab-history")) renderHistory();
};
document.getElementById("stdAddBtn").onclick = () => {
  const inp = document.getElementById("stdAddName");
  const db = itemsDb[stdGame];
  const id = db ? db.byName[normName(inp.value)] : "";
  const note = document.getElementById("stdNote");
  if(!id){ note.textContent = inp.value.trim() ? "Не нашёл «" + inp.value.trim() + "» в базе — выберите имя из подсказок." : "Введите имя."; return; }
  stdSetEdit(id, { from: document.getElementById("stdAddDate").value || "", std: document.getElementById("stdAddKind").value === "std" });
  inp.value = "";
  document.getElementById("stdAddDate").value = "";
};
document.getElementById("stdAddName").addEventListener("keydown", e => { if(e.key === "Enter") document.getElementById("stdAddBtn").click(); });
