"use strict";
/* ── отрисовка ── */
function render(){
  refreshToday();
  renderHeader();
  renderToday();
  renderGrid();
  renderTotals();
  renderMonthChart();
  renderYearChart();
  renderRecords();
  const n = Object.keys(data).length;
  document.getElementById("countNote").textContent = n ? "Отмечено дней всего: " + n : "";
}

function renderHeader(){
  document.getElementById("monthLabel").innerHTML = '<span class="ml">' + MONTHS[view.m] + '</span><span class="ms">' + MONTHS_SHORT[view.m] + "</span> " + view.y;
  document.getElementById("yLabel1").textContent = view.y;
  document.getElementById("yLabel2").textContent = view.y;
}

function renderToday(){
  const d = now.getDate();
  document.getElementById("todayDate").textContent = d + " " + MONTHS[now.getMonth()].toLowerCase() + ", " +
    ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"][now.getDay()];
  document.getElementById("todayTag").textContent = isGuar(d)
    ? "Сегодня гарантированно полихромы"
    : "Обычный день";

  const e = data[todayKey];
  const box = document.getElementById("todayStatus");
  box.innerHTML = "";
  if(e){
    const s = document.createElement("span");
    s.className = "got num" + (e.t === "d" ? " denny" : e.t === "m" ? " master" : "");
    s.textContent = e.t === "p" ? "+" + e.v + " полихромов"
      : e.t === "m" ? "+" + e.v + " мастер-диска"
      : "+" + fmt(e.v) + " денни";
    const b = document.createElement("button");
    b.className = "ghost";
    b.textContent = "Изменить";
    b.onclick = () => openPicker(todayKey);
    box.append(s, b);
  } else {
    const b = document.createElement("button");
    b.className = "mark";
    b.textContent = "Отметить награду";
    b.onclick = () => openPicker(todayKey);
    box.append(b);
  }
}

function renderGrid(){
  const g = document.getElementById("grid");
  g.innerHTML = "";
  const start = firstDow(view.y, view.m), n = daysIn(view.y, view.m);
  for(let i = 0; i < start; i++){
    const b = document.createElement("div");
    b.className = "cell blank";
    g.appendChild(b);
  }
  for(let d = 1; d <= n; d++){
    const k = iso(view.y, view.m, d);
    const e = data[k];
    const future = k > todayKey;
    const cell = document.createElement("button");
    let cls = "cell";
    if(isGuar(d)) cls += " guar";
    if(k === todayKey) cls += " today-c";
    if(future) cls += " future";
    if(e) cls += e.t === "p" ? " p p" + polyTier(e.v) : e.t === "m" ? " m" : " d";
    cell.className = cls;
    cell.type = "button";
    cell.innerHTML =
      '<span class="dn">' + d + '</span>' +
      (e ? '<span class="val">' + (e.t === "d"
            ? '<span class="vf">' + fmt(e.v) + '</span><span class="vs">' + String(Math.round(e.v / 100) / 10).replace(".", ",") + "к</span>"
            : e.v) + '</span>' +
           '<span class="sub">' + (e.t === "p" ? "полихромы" : e.t === "m" ? "мастер-диски" : "денни") + '</span>'
         : '<span class="sub">' + (future ? "" : "не отмечено") + '</span>');
    if(future){ cell.disabled = true; }
    else { cell.onclick = () => openPicker(k); }
    g.appendChild(cell);
  }
}

function renderTotals(){
  const ms = monthStats(view.y, view.m), ys = yearStats(view.y);
  document.getElementById("mPoly").textContent = fmt(ms.poly);
  document.getElementById("mDenny").textContent = fmt(ms.denny);
  document.getElementById("yPoly").textContent = fmt(ys.poly);
  document.getElementById("yDenny").textContent = fmt(ys.denny);
  document.getElementById("mLabel").textContent = MONTHS[view.m].toLowerCase();

  const pm = view.m === 0 ? 11 : view.m - 1;
  const py = view.m === 0 ? view.y - 1 : view.y;
  const prev = monthStats(py, pm);
  const dEl = document.getElementById("mDelta");
  if(prev.days === 0){
    dEl.textContent = ms.days ? "первый месяц с отметками" : "";
  } else {
    const diff = ms.poly - prev.poly;
    dEl.textContent = diff === 0
      ? "столько же, сколько в " + MONTHS_IN[pm]
      : Math.abs(diff) + (diff > 0 ? " больше" : " меньше") + ", чем в " + MONTHS_IN[pm];
  }

  const n = daysIn(view.y, view.m);
  // прошедшими считаем только завершённые дни: сегодня ещё можно отметить
  const past = (view.y < now.getFullYear() || (view.y === now.getFullYear() && view.m < now.getMonth()))
    ? n : (view.y === now.getFullYear() && view.m === now.getMonth() ? now.getDate() - 1 : 0);
  const markedPast = ms.days - (data[todayKey] && todayKey.slice(0,7) === view.y + "-" + pad(view.m+1) ? 1 : 0);
  const missed = Math.max(0, past - markedPast);
  document.getElementById("bar").style.width = Math.round(ms.days / n * 100) + "%";
  document.getElementById("coverage").textContent =
    "Отмечено " + ms.days + " из " + n + " дней" +
    (missed ? " · пропущено " + missed : "") +
    (ms.master ? " · мастер-дисков " + ms.master : "") +
    " · за год " + ys.days;
}

/* ── график месяца ── */
function renderMonthChart(){
  const n = daysIn(view.y, view.m);
  const W = chartW(document.getElementById("chartMonth")), H = 190, L = 26, R = 6, T = 16, B = 34;
  const iw = W - L - R, ih = H - T - B;
  const step = iw / n, bw = Math.min(step - 4, 16);
  const max = 60;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Полихромы по дням месяца">' +
    '<defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#ffdf95"/><stop offset="100%" stop-color="#c59a3c"/></linearGradient></defs>';

  [0,20,40,60].forEach(v => {
    const y = T + ih - (v / max) * ih;
    s += '<line x1="' + L + '" y1="' + y + '" x2="' + (W-R) + '" y2="' + y + '" stroke="rgba(255,255,255,.05)" stroke-width="1"/>';
    s += '<text x="' + (L-8) + '" y="' + (y+3.5) + '" fill="#5e5c68" font-size="10" text-anchor="end">' + v + '</text>';
  });

  for(let d = 1; d <= n; d++){
    const k = iso(view.y, view.m, d);
    const e = data[k];
    const cx = L + (d - 0.5) * step;
    const x = cx - bw / 2;
    if(e && e.t === "p"){
      const h = Math.max(4, (e.v / max) * ih);
      s += '<rect class="bar-h" x="' + x.toFixed(1) + '" y="' + (T + ih - h).toFixed(1) + '" width="' + bw.toFixed(1) +
           '" height="' + h.toFixed(1) + '" fill="url(#gp)" rx="3" opacity="' + (e.v >= 40 ? 1 : 0.72) + '">' +
           '<title>' + d + " " + MONTHS_SHORT[view.m] + ": " + e.v + ' полихромов</title></rect>';
    } else if(e && e.t === "m"){
      s += '<rect class="bar-h" x="' + x.toFixed(1) + '" y="' + (T + ih - 9) + '" width="' + bw.toFixed(1) +
           '" height="9" fill="#e0576f" rx="3" opacity="0.85"><title>' + d + " " + MONTHS_SHORT[view.m] + ": " + e.v + ' мастер-диска</title></rect>';
    } else if(e){
      s += '<rect class="bar-h" x="' + x.toFixed(1) + '" y="' + (T + ih - 5) + '" width="' + bw.toFixed(1) +
           '" height="5" fill="#39424c" rx="2.5"><title>' + d + " " + MONTHS_SHORT[view.m] + ": " + fmt(e.v) + ' денни</title></rect>';
    }
    if(isGuar(d)){
      s += '<circle cx="' + cx.toFixed(1) + '" cy="' + (T+ih+9) + '" r="2" fill="#7e6226"/>';
    }
    if(d === 1 || (d % 5 === 0 && (n - d >= 2 || W >= 500)) || d === n){
      s += '<text x="' + cx.toFixed(1) + '" y="' + (H-9) + '" fill="#5e5c68" font-size="10" text-anchor="middle">' + d + '</text>';
    }
  }
  s += '</svg>';
  document.getElementById("chartMonth").innerHTML = s;
}

/* ── график года ── */
function renderYearChart(){
  const W = chartW(document.getElementById("chartYear")), H = 210, L = 30, R = 6, T = 18, B = 46;
  const iw = W - L - R, ih = H - T - B;
  const step = iw / 12, bw = Math.min(step - 16, 30);
  const vals = [];
  let max = 0;
  for(let m = 0; m < 12; m++){
    const st = monthStats(view.y, m);
    vals.push(st);
    if(st.poly > max) max = st.poly;
  }
  max = Math.max(max, 100);
  const tick = Math.ceil(max / 3 / 50) * 50 || 50;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Полихромы по месяцам года">' +
    '<defs><linearGradient id="gy" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#f0c264"/><stop offset="100%" stop-color="#8a6a28"/></linearGradient>' +
    '<linearGradient id="gyc" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#ffdf95"/><stop offset="100%" stop-color="#d0a343"/></linearGradient></defs>';
  for(let v = 0; v <= max; v += tick){
    const y = T + ih - (v / max) * ih;
    s += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W-R) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,.05)"/>';
    s += '<text x="' + (L-8) + '" y="' + (y+3.5).toFixed(1) + '" fill="#5e5c68" font-size="10" text-anchor="end">' + v + '</text>';
  }
  for(let m = 0; m < 12; m++){
    const st = vals[m];
    const cx = L + (m + 0.5) * step;
    const h = st.poly ? Math.max(3, (st.poly / max) * ih) : 0;
    const cur = m === view.m;
    s += '<g class="bar-h" data-m="' + m + '" style="cursor:pointer">';
    s += '<rect x="' + (cx - step/2).toFixed(1) + '" y="' + T + '" width="' + step.toFixed(1) +
         '" height="' + (ih + B - 12) + '" fill="transparent"/>';
    if(h){
      s += '<rect x="' + (cx - bw/2).toFixed(1) + '" y="' + (T+ih-h).toFixed(1) +
           '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="url(#' + (cur ? "gyc" : "gy") + ')" rx="4">' +
           '<title>' + MONTHS[m] + ": " + st.poly + " полихромов, " + fmt(st.denny) + " денни" +
           (st.master ? ", " + st.master + " мастер-диска" : "") + '</title></rect>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + (T+ih-h-7).toFixed(1) + '" fill="' + (cur ? "#ffdf95" : "#7d7a86") +
           '" font-size="10.5" font-weight="500" text-anchor="middle">' + st.poly + '</text>';
    }
    // на узком экране подписываем через месяц, чтобы названия не слипались; текущий — всегда
    if(W >= 500 || cur || (m % 2 === 0 && Math.abs(m - view.m) > 1))
      s += '<text x="' + cx.toFixed(1) + '" y="' + (T+ih+17) + '" fill="' + (cur ? "#eceae5" : "#5e5c68") + '" font-size="10.5" text-anchor="middle">' + MONTHS_SHORT[m] + '</text>';
    if(W >= 500 || cur)
      s += '<text x="' + cx.toFixed(1) + '" y="' + (T+ih+31) + '" fill="#45434e" font-size="9.5" text-anchor="middle">' + (st.denny ? fmtK(st.denny) : "") + '</text>';
    s += '</g>';
  }
  s += '</svg>';
  const host = document.getElementById("chartYear");
  host.innerHTML = s;
  host.querySelectorAll("g[data-m]").forEach(el => {
    el.addEventListener("click", () => { view.m = +el.dataset.m; render(); });
  });
}

/* ── рекорды ── */
function daysInYear(y){ return new Date(y,1,29).getMonth() === 1 ? 366 : 365; }

const REC_COLS = [
  { k:"name",   label:"Месяц",     num:false },
  { k:"poly",   label:"Полихромы", num:true, cls:"poly" },
  { k:"denny",  label:"Денни",     num:true, cls:"denny", fmt:fmt },
  { k:"master", label:"Диски",     num:true, cls:"master" },
  { k:"days",   label:"Отмечено",  num:true }
];

function recAggregate(){
  const by = {};
  for(const k in data){
    const key = recMode === "year" ? k.slice(0,4) : k.slice(0,7);
    if(!by[key]) by[key] = { key:key, poly:0, denny:0, master:0, days:0 };
    const e = data[k];
    if(e.t === "p") by[key].poly += e.v;
    else if(e.t === "m") by[key].master += e.v;
    else by[key].denny += e.v;
    by[key].days++;
  }
  return Object.keys(by).map(k => {
    const r = by[k];
    const y = +k.slice(0,4);
    if(recMode === "year"){
      r.label = "" + y; r.total = daysInYear(y); r.y = y; r.m = null;
    } else {
      const m = +k.slice(5,7) - 1;
      r.label = MONTHS[m] + " " + y; r.total = daysIn(y,m); r.y = y; r.m = m;
    }
    return r;
  });
}

function recSortRows(rows){
  const dir = recSort.dir, key = recSort.key;
  return rows.sort((a,b) => {
    if(key === "name") return (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) * dir;
    return (a[key] - b[key]) * dir || (a.key < b.key ? 1 : -1);
  });
}

function renderRecHead(){
  const tr = document.getElementById("recHead");
  tr.innerHTML = "";
  const rank = document.createElement("th");
  rank.className = "rank";
  tr.appendChild(rank);
  REC_COLS.forEach(c => {
    const th = document.createElement("th");
    th.className = "sortable" + (recSort.key === c.k ? " sorted" : "");
    th.textContent = c.k === "name" && recMode === "year" ? "Год" : c.label;
    if(recSort.key === c.k){
      const a = document.createElement("span");
      a.className = "arw";
      a.textContent = recSort.dir < 0 ? "▼" : "▲";
      th.appendChild(a);
    }
    th.onclick = () => {
      if(recSort.key === c.k) recSort.dir = -recSort.dir;
      else recSort = { key:c.k, dir: c.num ? -1 : 1 };
      recPage = 0;
      ui.recSort = recSort; saveUI();
      renderRecords();
    };
    tr.appendChild(th);
  });
}

function renderRecords(){
  const tb = document.getElementById("records");
  const seg = document.getElementById("recSeg");
  const modeSeg = document.getElementById("recMode");
  const pager = document.getElementById("recPager");

  modeSeg.innerHTML = "";
  [["month","месяцы"],["year","годы"]].forEach(([v,label]) => {
    const b = document.createElement("button");
    b.textContent = label;
    if(recMode === v) b.classList.add("on");
    b.onclick = () => { recMode = v; recPage = 0; ui.recMode = v; saveUI(); renderRecords(); };
    modeSeg.appendChild(b);
  });
  renderRecHead();

  const all = recSortRows(recAggregate());
  if(!all.length){
    tb.innerHTML = '<tr><td colspan="6" class="empty">Пока пусто. Отметьте первую награду — период появится в таблице.</td></tr>';
    seg.innerHTML = "";
    pager.innerHTML = "";
    return;
  }

  const sizes = [10,20,50].filter(n => all.length > n);
  // выбранный размер сохраняем как есть, для показа берём подходящий
  const eff = (recLimit && sizes.indexOf(recLimit) !== -1) ? recLimit : 0;
  seg.innerHTML = "";
  if(sizes.length){
    sizes.concat([0]).forEach(n => {
      const b = document.createElement("button");
      b.textContent = n ? n : "все";
      if(eff === n) b.classList.add("on");
      b.onclick = () => { recLimit = n; recPage = 0; ui.recLimit = n; saveUI(); renderRecords(); };
      seg.appendChild(b);
    });
  }

  const per = eff || all.length;
  const pages = Math.max(1, Math.ceil(all.length / per));
  if(recPage > pages - 1) recPage = pages - 1;
  const from = recPage * per;
  const rows = all.slice(from, from + per);
  const medals = recSort.key === "poly" && recSort.dir < 0;

  tb.innerHTML = "";
  rows.forEach((r,i) => {
    const place = from + i + 1;
    const tr = document.createElement("tr");
    if(medals && place <= 3) tr.className = "top" + place;
    tr.innerHTML =
      '<td class="rank">' + place + '</td>' +
      '<td>' + r.label + '</td>' +
      '<td class="poly">' + r.poly + '</td>' +
      '<td class="denny">' + fmt(r.denny) + '</td>' +
      '<td class="master">' + (r.master || "—") + '</td>' +
      '<td>' + r.days + " / " + r.total + '</td>';
    tr.onclick = () => {
      view.y = r.y;
      if(r.m !== null) view.m = r.m;
      render();
      window.scrollTo({ top:0, behavior:"smooth" });
    };
    tb.appendChild(tr);
  });

  pager.innerHTML = "";
  if(pages > 1){
    const mk = (label, target, off) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.disabled = off;
      if(!off) b.onclick = () => { recPage = target; renderRecords(); };
      return b;
    };
    const info = document.createElement("span");
    info.textContent = (recMode === "year" ? "Годы " : "Месяцы ") + (from + 1) + "–" +
      Math.min(from + per, all.length) + " из " + all.length;
    pager.append(info, mk("‹", recPage - 1, recPage === 0), mk("›", recPage + 1, recPage >= pages - 1));
  }
}

/* ── выбор награды ── */
function openPicker(k){
  picking = k;
  const y = +k.slice(0,4), m = +k.slice(5,7) - 1, d = +k.slice(8,10);
  const g = isGuar(d);
  const cur = data[k];

  document.getElementById("sheetTitle").textContent = d + " " + MONTHS[m].toLowerCase() + " " + y;
  const sub = document.getElementById("sheetSub");
  sub.textContent = g ? "Гарантированный день полихромов" : "Что выпало сегодня";
  sub.className = "sub" + (g ? " guar" : "");

  // в гарантированные дни первыми идут полихромы, в обычные — денни как самая частая награда
  const order = g ? ["p","d"] : ["d","p"];
  keyMap = {};
  let ki = 1;
  order.forEach(t => {
    (t === "p" ? POLY : DENNY).forEach(v => { keyMap[ki++] = { t:t, v:v }; });
  });
  keyMap[9] = { t:"m", v:MASTER[0] };   // мастер-диски всегда последние

  const host = document.getElementById("optsHost");
  order.forEach(t => host.appendChild(document.getElementById(t === "p" ? "secPoly" : "secDenny")));
  host.appendChild(document.getElementById("secMaster"));

  function keyOf(t,v){
    for(const n in keyMap){ if(keyMap[n].t === t && keyMap[n].v === v) return n; }
    return "";
  }
  function fill(id, list, t, cls, label){
    const box = document.getElementById(id);
    box.innerHTML = "";
    list.forEach(v => {
      const b = document.createElement("button");
      b.className = "opt " + cls + (t === "p" && v === 60 ? " big" : "") +
        (cur && cur.t === t && cur.v === v ? " sel" : "");
      b.innerHTML = "<b>" + (t === "d" ? fmt(v) : v) + "</b><small>" + label + "</small><kbd>" + keyOf(t,v) + "</kbd>";
      b.onclick = () => setDay(k, t, v);
      box.appendChild(b);
    });
  }
  fill("polyOpts", POLY, "p", "p", "полихромы");
  fill("dennyOpts", DENNY, "d", "d", "денни");
  fill("masterOpts", MASTER, "m", "m", "мастер-диски · редко");

  const hideRest = g && !(cur && (cur.t === "d" || cur.t === "m"));
  document.getElementById("secDenny").classList.toggle("collapsed", hideRest);
  document.getElementById("secMaster").classList.toggle("collapsed", hideRest);
  document.getElementById("showDenny").classList.toggle("collapsed", !hideRest);

  document.getElementById("clearDay").style.display = cur ? "" : "none";
  document.getElementById("overlay").classList.add("on");
  const sel = host.querySelector(".opt.sel");
  (sel || host.querySelector("div:not(.collapsed) .opt")).focus();
}

function closePicker(){
  picking = null;
  document.getElementById("overlay").classList.remove("on");
}

function setDay(k, t, v){
  data[k] = { t:t, v:v };
  store.save(data);
  closePicker();
  render();
}

/* ── события календаря ── */
document.getElementById("prev").onclick = () => { if(--view.m < 0){ view.m = 11; view.y--; } render(); };
document.getElementById("next").onclick = () => { if(++view.m > 11){ view.m = 0; view.y++; } render(); };
document.getElementById("toToday").onclick = () => {
  refreshToday();
  view = { y: now.getFullYear(), m: now.getMonth() };
  render();
};
document.getElementById("closeSheet").onclick = closePicker;
document.getElementById("clearDay").onclick = () => {
  if(picking){ delete data[picking]; store.save(data); }
  closePicker(); render();
};
document.getElementById("showDenny").onclick = function(){
  document.getElementById("secDenny").classList.remove("collapsed");
  document.getElementById("secMaster").classList.remove("collapsed");
  this.classList.add("collapsed");
};
document.getElementById("overlay").addEventListener("mousedown", e => {
  if(e.target.id === "overlay") closePicker();
});
document.addEventListener("keydown", e => {
  if(document.getElementById("confirmOverlay").classList.contains("on")){
    if(e.key === "Escape") closeConfirm();
    return;
  }
  if(document.getElementById("dataOverlay").classList.contains("on")){
    if(e.key === "Escape") closeData();
    return;
  }
  if(document.getElementById("settingsOverlay").classList.contains("on")){
    if(e.key === "Escape") closeSettings();
    return;
  }
  if(document.getElementById("importOverlay").classList.contains("on")){
    if(e.key === "Escape") closeImport();
    return;
  }
  if(e.key === "Escape" && document.body.classList.contains("menu-open")){ closeSide(); return; }
  if(e.key === "Escape" && menuOpen()){ closeMenu(); return; }
  if(patchPickOpen() && e.key === "Escape"){ closePatchPick(); return; }
  if(gamePickOpen() && e.key === "Escape"){ closeGamePick(); return; }
  if(document.body.classList.contains("tab-pulls")){
    if(document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if(e.key === "ArrowLeft"){ stepPatch(-1); return; }
    if(e.key === "ArrowRight"){ stepPatch(1); return; }
    return;
  }
  if(pickOpen()){
    if(e.key === "Escape"){ closePick(); return; }
    if(e.key === "ArrowLeft"){ pickY--; renderPick(); return; }
    if(e.key === "ArrowRight"){ pickY++; renderPick(); return; }
  }
  if(!picking){
    if(e.key === "ArrowLeft") document.getElementById("prev").click();
    if(e.key === "ArrowRight") document.getElementById("next").click();
    return;
  }
  if(e.key === "Escape"){ closePicker(); return; }
  const hit = keyMap[e.key];
  if(hit) setDay(picking, hit.t, hit.v);
});
