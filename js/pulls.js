"use strict";
/* ══ раздел «Крутки»: типы круток, валюта, патчи, несколько игр ══ */
const PKEY = "zzz-pulls-v1";
const pstore = makeStore(PKEY);
let pdata = pstore.load();
if(!pdata || !pdata.games) pdata = { games:[], active:null };
let openTypes = ui.openTypes || {}, openCalc = ui.openCalc || {};

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function pSave(){ pstore.save(pdata); }
function fmtP(x){ return (Math.round(x * 10) / 10).toLocaleString("ru-RU"); }
function dmy(s){ return s ? s.split("-").reverse().join(".") : ""; }

function G(){
  if(!pdata.games.length){
    pdata.games.push({
      id: uid(), name: "Zenless Zone Zero", patch: null, patches: [],
      types: [{ id: uid(), name: "Обычные", currencies: [
        { id:uid(), name:"Мастер-ленты", rate:1, amount:0 },
        { id:uid(), name:"Полихромы", rate:160, amount:0 }
      ]}]
    });
    pdata.active = pdata.games[0].id;
    pSave();
  }
  const g = pdata.games.find(x => x.id === pdata.active) || pdata.games[0];
  // перенос старого формата (валюты без типов, операции)
  if(!g.types){
    g.types = [{ id: uid(), name: "Обычные", currencies: (g.currencies || []).map(c => ({ id:c.id, name:c.name, rate:c.rate, amount:0 })) }];
    delete g.currencies;
    (g.patches || []).forEach(p => {
      if(typeof p.start === "number"){ const o = {}; o[g.types[0].id] = p.start; p.start = o; }
      delete p.ops;
    });
    pSave();
  }
  return g;
}
function P(){ const g = G(); return g.patches.find(x => x.id === g.patch) || null; }
function curPulls(c){ return (c.amount || 0) / (c.rate > 0 ? c.rate : 1); }
function tracked(c){ return c.track !== false; }
function typePulls(t){ return (t.currencies || []).reduce((s,c) => s + curPulls(c), 0); }
// в статистику патча идут только отслеживаемые валюты
function typeTracked(t){ return (t.currencies || []).reduce((s,c) => s + (tracked(c) ? curPulls(c) : 0), 0); }
function typeMuted(t){ return (t.currencies || []).filter(c => !tracked(c)).length; }
function nowMap(g){ const o = {}; (g.types||[]).forEach(t => o[t.id] = typeTracked(t)); return o; }
function sortedPatches(g){
  return (g.patches||[]).slice().sort((a,b) => (a.date||"") < (b.date||"") ? -1 : (a.date||"") > (b.date||"") ? 1 : 0);
}
// конец патча — это старт следующего по дате, а для последнего — текущий остаток
function endMap(g, p){
  const ps = sortedPatches(g);
  const i = ps.findIndex(x => x.id === p.id);
  const nxt = ps[i+1];
  return nxt ? (nxt.start || {}) : nowMap(g);
}
function patchStats(g, p){
  const end = endMap(g, p), st = p.start || {};
  let s = 0, e = 0;
  (g.types||[]).forEach(t => { s += st[t.id] || 0; e += end[t.id] || 0; });
  return { start:s, end:e, diff:e - s };
}
function signed(x){ return (x > 0 ? "+" : x < 0 ? "−" : "") + fmtP(Math.abs(x)); }
function signCls(x){ return x < 0 ? "master" : "poly"; }

function renderPulls(){
  const g = G(), p = P();
  document.getElementById("hTitle").childNodes[0].nodeValue = "Крутки";
  document.getElementById("hSub").textContent = g.name;
  document.getElementById("patchLabel").textContent = p ? "Патч " + p.name : "+ создать патч";

  renderGames();
  renderPatchList();
  renderTypes();
  renderCalc();
  renderPatchTable(g);
  renderPatchChart(g);
  if(typeof renderOdds === "function" && ui.tab === "pulls") renderOdds();

  const trackedTotal = (g.types||[]).reduce((s,t) => s + typeTracked(t), 0);
  document.getElementById("pLeft").textContent = fmtP(trackedTotal);
  document.getElementById("pByType").textContent =
    (g.types||[]).map(t => t.name.toLowerCase() + " " + fmtP(typePulls(t)) +
      (typeMuted(t) ? " (в патче " + fmtP(typeTracked(t)) + ")" : "")).join(" · ");

  if(!p){
    ["pStart","pEnd","pIn"].forEach(i => document.getElementById(i).textContent = "—");
    const sm = document.getElementById("pSummary");
    sm.innerHTML = "Патчей пока нет. ";
    const lb = document.createElement("button");
    lb.className = "linkbtn";
    lb.textContent = "Создать первый патч";
    lb.onclick = () => openPatchPick(true);
    sm.appendChild(lb);
  } else {
    const st = patchStats(g, p);
    document.getElementById("pStart").textContent = fmtP(st.start);
    document.getElementById("pEnd").textContent = fmtP(st.end);
    document.getElementById("pIn").textContent = signed(st.diff);
    const ps = sortedPatches(g), i = ps.findIndex(x => x.id === p.id);
    document.getElementById("pSummary").textContent =
      "Патч " + p.name + (p.date ? " · с " + dmy(p.date) : "") +
      (ps[i+1] ? " по " + dmy(ps[i+1].date) + " · завершён" : " · идёт сейчас");
  }
}

function renderGames(){
  const g = G();
  document.getElementById("gameLabel").textContent = g.name;
  const ren = document.getElementById("gameRename");
  if(document.activeElement !== ren) ren.value = g.name;
  ren.onchange = () => {
    const v = ren.value.trim();
    if(v){ g.name = v; pSave(); renderPulls(); renderSide(); } else { ren.value = g.name; }
  };
  document.getElementById("gameDel").onclick = () => {
    closeGamePick();
    if(g.key) return;
    askConfirm("Удалить профиль?", "«" + g.name + "» со всеми патчами и валютой будет удалена.", "Удалить", () => {
      pdata.games = pdata.games.filter(y => y.id !== g.id);
      pSave();
      const next = customGames()[0];
      setNav(next ? "c:" + next.id : "zzz", "pulls");
    });
  };
  const box = document.getElementById("gameChips");
  box.innerHTML = "";
  pdata.games.forEach(x => {
    const b = document.createElement("button");
    b.className = x.id === g.id ? "on" : "";
    const nm = document.createElement("b");
    nm.textContent = x.name;
    b.appendChild(nm);
    b.onclick = () => { pdata.active = x.id; pSave(); renderPulls(); closeGamePick(); };
    if(pdata.games.length > 1 && x.id === g.id){
      const s = document.createElement("span");
      s.textContent = "удалить";
      s.style.cursor = "pointer";
      s.onclick = e => {
        e.stopPropagation();
        closeGamePick();
        askConfirm("Удалить игру?", "«" + x.name + "» со всеми патчами и валютой будет удалена.", "Удалить", () => {
          pdata.games = pdata.games.filter(y => y.id !== x.id);
          pdata.active = pdata.games[0] ? pdata.games[0].id : null;
          pSave(); renderPulls();
        });
      };
      b.appendChild(s);
    }
    box.appendChild(b);
  });
}

function renderPatchList(){
  const g = G(), p = P();
  document.getElementById("patchEdit").classList.toggle("hidden", !p);
  if(p){
    const rn = document.getElementById("patchRename");
    const rd = document.getElementById("patchReDate");
    if(document.activeElement !== rn) rn.value = p.name;
    if(document.activeElement !== rd) rd.value = p.date || "";
    rn.onchange = () => {
      const v = rn.value.trim();
      if(v){ p.name = v; pSave(); renderPulls(); } else { rn.value = p.name; }
    };
    rd.onchange = () => {
      if(rd.value){ p.date = rd.value; pSave(); renderPulls(); } else { rd.value = p.date || ""; }
    };
  }
  const box = document.getElementById("patchList");
  box.innerHTML = "";
  const ps = sortedPatches(g).reverse();
  if(!ps.length){
    box.innerHTML = '<p class="nodata" style="padding:4px 10px">Патчей пока нет.</p>';
    return;
  }
  ps.forEach(x => {
    const b = document.createElement("button");
    b.className = p && x.id === p.id ? "on" : "";
    b.innerHTML = '<b>' + esc(x.name) + '</b><span>' + dmy(x.date) + " · " + signed(patchStats(g,x).diff) + '</span>';
    b.onclick = () => { g.patch = x.id; pSave(); renderPulls(); };
    box.appendChild(b);
  });
}

function renderTypes(){
  const g = G();
  const host = document.getElementById("typeList");
  host.innerHTML = "";
  if(!(g.types||[]).length){
    host.innerHTML = '<p class="nodata">Типов круток нет — добавьте первый.</p>';
    return;
  }
  g.types.forEach(t => {
    const open = !!openTypes[t.id];
    const acc = document.createElement("div");
    acc.className = "acc" + (open ? " open" : "");

    const head = document.createElement("button");
    head.className = "acchead";
    const muted = typeMuted(t);
    head.innerHTML = '<span class="caret">▶</span><span class="nm">' + esc(t.name) + '</span>' +
      '<span class="cnt">' + (t.currencies||[]).length + " вал." +
      (muted ? " · " + muted + " вне патча" : "") + "</span>" +
      '<span class="sum num">' + fmtP(typePulls(t)) + '</span><span class="unit">круток</span>';
    head.onclick = () => {
      openTypes[t.id] = !open;
      ui.openTypes = openTypes; saveUI();
      renderTypes();
    };
    acc.appendChild(head);

    if(open){
      const body = document.createElement("div");
      body.className = "accbody";

      const tn = document.createElement("div");
      tn.className = "typename";
      const tnLabel = document.createElement("span");
      tnLabel.textContent = "Название типа";
      const tnInput = document.createElement("input");
      tnInput.value = t.name;
      tnInput.maxLength = 30;
      tnInput.onchange = () => {
        const v = tnInput.value.trim();
        if(v){ t.name = v; pSave(); renderPulls(); } else { tnInput.value = t.name; }
      };
      tn.append(tnLabel, tnInput);
      body.appendChild(tn);

      const hd = document.createElement("div");
      hd.className = "curline";
      hd.innerHTML = '<div class="hd">Валюта</div><div class="hd" style="text-align:right">Единиц на крутку</div><div class="hd" style="text-align:right">Есть сейчас</div><div class="hd" style="text-align:center">В патче</div><div></div>';
      body.appendChild(hd);

      (t.currencies||[]).forEach(c => {
        const row = document.createElement("div");
        row.className = "curline";
        const nm = document.createElement("input");
        nm.className = "nm"; nm.value = c.name;
        nm.onchange = () => { c.name = nm.value.trim() || c.name; pSave(); renderPulls(); };
        const rt = document.createElement("input");
        rt.type = "number"; rt.step = "any"; rt.min = "0"; rt.value = c.rate;
        rt.onchange = () => { const v = parseFloat(rt.value); if(v > 0){ c.rate = v; pSave(); renderPulls(); } };
        const am = document.createElement("input");
        am.type = "number"; am.step = "any"; am.min = "0"; am.value = c.amount || 0;
        am.onchange = () => { c.amount = Math.max(0, parseFloat(am.value) || 0); pSave(); renderPulls(); };
        const trk = document.createElement("button");
        trk.className = "iconbtn trk" + (tracked(c) ? "" : " off");
        trk.textContent = tracked(c) ? "●" : "○";
        trk.title = tracked(c)
          ? "Учитывается в изменении за патч — нажмите, чтобы исключить"
          : "Не учитывается в изменении за патч";
        trk.onclick = () => { c.track = !tracked(c); pSave(); renderPulls(); };
        const del = document.createElement("button");
        del.className = "iconbtn"; del.textContent = "×"; del.title = "Удалить валюту";
        del.onclick = () => {
          t.currencies = t.currencies.filter(x => x.id !== c.id);
          pSave(); renderPulls();
        };
        row.append(nm, rt, am, trk, del);
        body.appendChild(row);
      });

      const foot = document.createElement("div");
      foot.className = "accfoot";
      const add = document.createElement("button");
      add.className = "ghost sm"; add.textContent = "+ валюта";
      add.onclick = () => {
        t.currencies = t.currencies || [];
        t.currencies.push({ id:uid(), name:"Новая валюта", rate:1, amount:0 });
        pSave(); renderPulls();
      };
      const dlt = document.createElement("button");
      dlt.className = "linkbtn"; dlt.textContent = "удалить тип";
      dlt.style.marginLeft = "auto";
      dlt.onclick = () => askConfirm("Удалить тип круток?", "«" + t.name + "» и его валюты будут удалены.", "Удалить", () => {
        g.types = g.types.filter(x => x.id !== t.id);
        (g.patches||[]).forEach(pt => { if(pt.start) delete pt.start[t.id]; });
        pSave(); renderPulls();
      });
      foot.append(add, dlt);
      body.appendChild(foot);
      acc.appendChild(body);
    }
    host.appendChild(acc);
  });
}

function renderCalc(){
  const g = G(), p = P();
  const tb = document.getElementById("calcBody");
  tb.innerHTML = "";
  if(!p){
    tb.innerHTML = '<tr><td colspan="4" class="empty">Нет активного патча.</td></tr>';
    return;
  }
  const end = endMap(g, p);
  const rows = (g.types||[]).filter(t => (t.currencies||[]).some(tracked));
  if(!rows.length){
    tb.innerHTML = '<tr><td colspan="4" class="empty">Ни одна валюта не отслеживается в патче.</td></tr>';
    return;
  }
  let ts = 0, te = 0;
  rows.forEach(t => {
    const st = (p.start||{})[t.id] || 0;
    const en = end[t.id] || 0;
    ts += st; te += en;
    const open = !!openCalc[t.id];
    const tr = document.createElement("tr");
    tr.className = "type-row" + (open ? " open" : "");
    tr.innerHTML = '<td class="tcell" title="Показать валюты этого типа">' +
      '<span class="tinner"><span class="caret">▶</span><span class="tnm">' + esc(t.name) + '</span></span>' +
      '</td><td></td><td>' + fmtP(en) +
      '</td><td class="' + signCls(en - st) + '">' + signed(en - st) + '</td>';
    tr.children[0].onclick = () => {
      openCalc[t.id] = !open;
      ui.openCalc = openCalc; saveUI();
      renderCalc();
    };
    const i = document.createElement("input");
    i.className = "cell-in num"; i.type = "number"; i.step = "any"; i.min = "0";
    i.value = Math.round(st * 10) / 10;
    i.title = "Остаток круток этого типа на старте патча";
    i.onchange = () => {
      p.start = p.start || {};
      p.start[t.id] = Math.max(0, parseFloat(i.value) || 0);
      pSave(); renderPulls();
    };
    tr.children[1].appendChild(i);
    tb.appendChild(tr);

    if(open){
      const cur = (t.currencies||[]).filter(tracked);
      if(!cur.length){
        const e0 = document.createElement("tr");
        e0.className = "sub";
        e0.innerHTML = '<td colspan="4">Нет отслеживаемых валют.</td>';
        tb.appendChild(e0);
      }
      cur.forEach(c => {
        const sub = document.createElement("tr");
        sub.className = "sub";
        sub.style.cursor = "default";
        sub.innerHTML =
          '<td>' + esc(c.name) + '<span class="raw">' + fmt(Math.round((c.amount||0)*100)/100) +
            " ÷ " + c.rate + '</span></td>' +
          '<td></td><td>' + fmtP(curPulls(c)) + '</td><td></td>';
        tb.appendChild(sub);
      });
    }
  });
  const sum = document.createElement("tr");
  sum.className = "sum-row";
  sum.style.cursor = "default";
  sum.innerHTML = '<td>Всего</td><td>' + fmtP(ts) + '</td><td>' + fmtP(te) +
    '</td><td class="' + signCls(te - ts) + '">' + signed(te - ts) + '</td>';
  tb.appendChild(sum);
}

function renderPatchTable(g){
  const tb = document.getElementById("patchBody");
  tb.innerHTML = "";
  const ps = sortedPatches(g).reverse();
  if(!ps.length){
    tb.innerHTML = '<tr><td colspan="5" class="empty">Пока нет ни одного патча.</td></tr>';
    return;
  }
  ps.forEach(p => {
    const st = patchStats(g, p);
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td>' + esc(p.name) + '</td>' +
      '<td style="color:var(--dim)">' + dmy(p.date) + '</td>' +
      '<td>' + fmtP(st.start) + '</td>' +
      '<td class="denny">' + fmtP(st.end) + '</td>' +
      '<td class="' + signCls(st.diff) + '">' + signed(st.diff) + '</td>';
    tr.onclick = () => { g.patch = p.id; pSave(); renderPulls(); window.scrollTo({top:0,behavior:"smooth"}); };
    tb.appendChild(tr);
  });
}

function renderPatchChart(g){
  const host = document.getElementById("patchChart");
  const list = sortedPatches(g).slice(-12);
  if(list.length < 2){ host.innerHTML = ""; return; }
  const W = 720, H = 190, L = 34, R = 6, T = 16, B = 34;
  const iw = W - L - R, ih = H - T - B;
  const step = iw / list.length, bw = Math.min(step - 16, 34);
  const stats = list.map(p => patchStats(g, p));
  let max = 10, min = 0;
  stats.forEach(s => { max = Math.max(max, s.diff); min = Math.min(min, s.diff); });
  const span = max - min || 1;
  const zero = T + ih * (max / span);
  const tick = Math.max(1, Math.round(span / 4));
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Изменение круток по патчам">' +
    '<defs><linearGradient id="gpin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffdf95"/><stop offset="100%" stop-color="#c59a3c"/></linearGradient>' +
    '<linearGradient id="gpout" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8a3247"/><stop offset="100%" stop-color="#e0576f"/></linearGradient></defs>';
  for(let v = Math.ceil(min / tick) * tick; v <= max; v += tick){
    const y = T + ih * ((max - v) / span);
    s += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W-R) + '" y2="' + y.toFixed(1) +
         '" stroke="rgba(255,255,255,' + (v === 0 ? ".14" : ".05") + ')"/>';
    s += '<text x="' + (L-8) + '" y="' + (y+3.5).toFixed(1) + '" fill="#5e5c68" font-size="10" text-anchor="end">' + v + '</text>';
  }
  list.forEach((p, i) => {
    const d = stats[i].diff;
    const cx = L + (i + 0.5) * step;
    const hgt = Math.abs(d) / span * ih;
    const y = d >= 0 ? zero - hgt : zero;
    s += '<g class="bar-h">';
    if(hgt > 0.5){
      s += '<rect x="' + (cx - bw/2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) +
           '" height="' + hgt.toFixed(1) + '" fill="url(#' + (d >= 0 ? "gpin" : "gpout") + ')" rx="3">' +
           '<title>' + esc(p.name) + ": " + signed(d) + '</title></rect>';
    }
    s += '<text x="' + cx.toFixed(1) + '" y="' + (T+ih+17) + '" fill="#5e5c68" font-size="10" text-anchor="middle">' + esc(p.name) + '</text>';
    s += '</g>';
  });
  s += '</svg>';
  host.innerHTML = s +
    '<div class="legend"><span><i style="background:linear-gradient(180deg,#ffdf95,#c59a3c)"></i>накопили за патч</span>' +
    '<span><i style="background:linear-gradient(180deg,#e0576f,#8a3247)"></i>потратили больше, чем получили</span></div>';
}

/* ── управление патчами и играми ── */
function gamePickOpen(){ return document.getElementById("gamePicker").classList.contains("on"); }
function closeGamePick(){
  document.getElementById("gamePicker").classList.remove("on");
  document.getElementById("gameLabel").setAttribute("aria-expanded","false");
}
document.getElementById("gameLabel").onclick = e => {
  e.stopPropagation();
  if(gamePickOpen()){ closeGamePick(); return; }
  closeMenu(); closePatchPick();
  renderGames();
  document.getElementById("gamePicker").classList.add("on");
  document.getElementById("gameLabel").setAttribute("aria-expanded","true");
};
function patchPickOpen(){ return document.getElementById("patchPicker").classList.contains("on"); }
function closePatchPick(){
  document.getElementById("patchPicker").classList.remove("on");
  document.getElementById("patchLabel").setAttribute("aria-expanded","false");
}
function openPatchPick(withForm){
  closeMenu(); closeGamePick();
  renderPulls();
  document.getElementById("patchPicker").classList.add("on");
  document.getElementById("patchLabel").setAttribute("aria-expanded","true");
  if(withForm){
    document.getElementById("patchForm").classList.remove("hidden");
    document.getElementById("patchDate").value = todayKey;
    document.getElementById("patchName").focus();
  }
  window.scrollTo({ top:0, behavior:"smooth" });
}
document.getElementById("patchLabel").onclick = e => {
  e.stopPropagation();
  if(patchPickOpen()) closePatchPick();
  else openPatchPick(!P());
};
function stepPatch(dir){
  const g = G(), ps = sortedPatches(g);
  if(!ps.length) return;
  let i = ps.findIndex(x => x.id === g.patch);
  if(i === -1) i = ps.length - 1;
  i = Math.min(ps.length - 1, Math.max(0, i + dir));
  g.patch = ps[i].id;
  pSave(); renderPulls();
}
document.getElementById("patchPrev").onclick = () => stepPatch(-1);
document.getElementById("patchNext").onclick = () => stepPatch(1);

document.getElementById("addGame").onclick = () => {
  document.getElementById("gameForm").classList.remove("hidden");
  document.getElementById("gameName").focus();
};
document.getElementById("gameSave").onclick = () => {
  const nm = document.getElementById("gameName").value.trim();
  if(!nm) return;
  const g = { id:uid(), name:nm, patch:null, patches:[],
    types:[{ id:uid(), name:"Обычные", currencies:[{ id:uid(), name:"Крутки", rate:1, amount:0 }] }] };
  pdata.games.push(g);
  pdata.active = g.id;
  pSave();
  document.getElementById("gameName").value = "";
  document.getElementById("gameForm").classList.add("hidden");
  closeGamePick();
  renderPulls();
};
document.getElementById("addPatch").onclick = () => {
  document.getElementById("patchForm").classList.remove("hidden");
  document.getElementById("patchDate").value = todayKey;
  document.getElementById("patchName").focus();
};
document.getElementById("patchSave").onclick = () => {
  const g = G();
  const nm = document.getElementById("patchName").value.trim();
  if(!nm) return;
  // старт берём из текущего остатка, потом его можно поправить в таблице патча
  const p = { id:uid(), name:nm, date:document.getElementById("patchDate").value || todayKey,
    start: nowMap(g) };
  g.patches.push(p);
  g.patch = p.id;
  pSave();
  document.getElementById("patchName").value = "";
  document.getElementById("patchForm").classList.add("hidden");
  renderPulls();
};
document.getElementById("addType").onclick = () => {
  document.getElementById("typeForm").classList.remove("hidden");
  document.getElementById("typeName").focus();
};
document.getElementById("typeCancel").onclick = () => document.getElementById("typeForm").classList.add("hidden");
document.getElementById("typeSave").onclick = () => {
  const g = G();
  const nm = document.getElementById("typeName").value.trim();
  if(!nm) return;
  const t = { id:uid(), name:nm, currencies:[{ id:uid(), name:"Крутки", rate:1, amount:0 }] };
  g.types.push(t);
  openTypes[t.id] = true;
  pSave();
  document.getElementById("typeName").value = "";
  document.getElementById("typeForm").classList.add("hidden");
  renderPulls();
};
