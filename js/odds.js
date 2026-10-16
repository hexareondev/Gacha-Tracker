"use strict";
/* ══ шансы: модель гаранта и калькулятор «хватит ли на персонажа» ══
   Вероятность S-ранга (5★) на i-й крутке после прошлого: базовая до мягкого
   гаранта, затем растёт на шаг с каждой круткой, на жёстком гаранте — 100%.
   Это общепринятая модель сообщества, а не официальные цифры: игры их не публикуют. */
const PITY_MODEL = {
  char:  { base:.006, soft:74, step:.06, hard:90 },   // персонажи / агенты
  gweap: { base:.007, soft:63, step:.07, hard:80 },   // оружие Genshin
  lc:    { base:.008, soft:66, step:.07, hard:80 },   // световые конусы
  wen:   { base:.01,  soft:65, step:.07, hard:80 }    // амплификаторы
};
const CHANNEL_MODEL = {
  hk4e:  { "301":"char", "200":"char", "500":"char", "302":"gweap" },
  hkrpg: { "11":"char", "21":"char", "1":"char", "12":"lc", "22":"lc" },
  nap:   { "2":"char", "102":"char", "1":"char", "3":"wen", "103":"wen" }
};
function pityRate(m, i){
  if(i >= m.hard) return 1;
  if(i < m.soft) return m.base;
  return Math.min(1, m.base + m.step * (i - m.soft + 1));
}
// распределение номера крутки, на которой выпадет топ (индекс 1..hard)
const pmfCache = {};
function pityPmf(name){
  if(pmfCache[name]) return pmfCache[name];
  const m = PITY_MODEL[name], out = [0];
  let surv = 1;
  for(let i = 1; i <= m.hard; i++){ const p = pityRate(m, i); out.push(surv * p); surv *= 1 - p; }
  return (pmfCache[name] = out);
}
function pityMean(name){ return pityPmf(name).reduce((s, p, i) => s + p * i, 0); }

const ODDS = {
  gi: {
    char:{ ch:"301", model:"char",  win:.5,   what:"персонажа", unit:"C", from:0, max:7 },
    weap:{ ch:"302", model:"gweap", win:.375, what:"оружие",    unit:"R", from:1, max:5 }
  },
  hsr: {
    char:{ ch:"11", model:"char", win:.5,  what:"персонажа", unit:"E", from:0, max:7 },
    weap:{ ch:"12", model:"lc",   win:.75, what:"конус",     unit:"S", from:1, max:5 }
  },
  zzz: {
    char:{ ch:"2", model:"char", win:.5,  what:"агента",       unit:"M", from:0, max:7 },
    weap:{ ch:"3", model:"wen",  win:.75, what:"амплификатор", unit:"",  from:1, max:5 }
  }
};
// как называть топовое выпадение в каждой игре
const TOP_WORD = {
  gi:  { nom:"5★", gen:"5★", loc:"5★" },
  hsr: { nom:"5★", gen:"5★", loc:"5★" },
  zzz: { nom:"S-ранг", gen:"S-ранга", loc:"S-ранге" }
};
const ODDS_NOTE = {
  gi:"У персонажей Genshin шанс 50/50 взят ровно 50% — механика «Захватывающего сияния» его немного повышает, так что на деле шансы чуть выше. У оружия учтён путь воплощения: после промаха следующее 5★ оружие — выбранное.",
  hsr:"Шанс 50/50 у персонажей — 50%, у конусов 75/25.",
  zzz:"Шанс 50/50 у агентов — 50%, у амплификаторов 75/25."
};
/* Динамика по круткам: состояние — сколько круток с прошлого топа, есть ли гарант,
   сколько нужных копий уже выпало (последнее значение поглощающее).
   cfg.m — модель гаранта (обычная или подстроенная под удачу аккаунта), cfg.win — шанс 50/50.
   Возвращает шанс после pulls круток, пороги 50/90/100% и кривые P(≥k) по каждой крутке. */
function oddsWorst(m, pity, guar, k){ return (m.hard - pity) + (guar ? 0 : m.hard) + (k - 1) * 2 * m.hard; }
function oddsRun(cfg, pity, guar, pulls, K){
  const m = cfg.m || PITY_MODEL[cfg.model], H = m.hard;
  pity = Math.min(Math.max(0, pity), H - 1);
  const S = (K + 1) * 2 * H;
  let cur = new Float64Array(S), nxt = new Float64Array(S);
  const at = (c, g, j) => (c * 2 + g) * H + j;
  cur[at(0, guar ? 1 : 0, pity)] = 1;
  const steps = Math.max(pulls, oddsWorst(m, pity, guar, K));
  const curve = [];
  for(let k = 0; k <= K; k++){ const a = new Float64Array(steps + 1); if(!k) a.fill(1); curve.push(a); }
  const atN = new Array(K + 1).fill(0);
  const cross = [];
  for(let k = 0; k <= K; k++) cross.push({ p50:null, p90:null, p100:null });
  for(let n = 1; n <= steps; n++){
    nxt.fill(0);
    for(let c = 0; c < K; c++) for(let g = 0; g < 2; g++) for(let j = 0; j < H; j++){
      const q = cur[at(c, g, j)];
      if(!q) continue;
      const p = pityRate(m, j + 1);
      const w = g ? 1 : cfg.win;
      nxt[at(c + 1, 0, 0)] += q * p * w;
      if(w < 1) nxt[at(c, 1, 0)] += q * p * (1 - w);
      if(j + 1 < H) nxt[at(c, g, j + 1)] += q * (1 - p);
    }
    for(let j = 0; j < 2 * H; j++) nxt[K * 2 * H + j] += cur[K * 2 * H + j];
    const t = cur; cur = nxt; nxt = t;
    let acc = 0;
    for(let c = K; c >= 1; c--){
      for(let j = 0; j < 2 * H; j++) acc += cur[c * 2 * H + j];
      const v = Math.min(1, acc);
      curve[c][n] = v;
      if(n === pulls) atN[c] = v;
      const x = cross[c];
      if(x.p50 === null && v >= .5) x.p50 = n;
      if(x.p90 === null && v >= .9) x.p90 = n;
    }
  }
  if(pulls <= 0) for(let c = 1; c <= K; c++) atN[c] = 0;
  // «наверняка» — худший случай по правилам гаранта, а не по численной точности
  for(let c = 1; c <= K; c++) cross[c].p100 = oddsWorst(m, pity, guar, c);
  return { atN, cross, curve };
}
/* Персонаж и оружие из одного запаса: сначала крутится персонаж, остаток — на оружие.
   P(успех за T) = Σ по n [персонаж набран ровно на n-й крутке] × [оружие набрано за T − n]. */
function comboAt(C, Wk, T){
  let s = 0;
  const top = Math.min(T, C.length - 1);
  for(let n = 1; n <= top; n++){
    const d = C[n] - C[n - 1];
    if(d <= 0) continue;
    const r = T - n;
    s += d * (r >= Wk.length ? 1 : Wk[r]);
  }
  return Math.min(1, s);
}
function comboCross(C, Wk, worst){
  const x = { p50:null, p90:null, p100:worst };
  for(let T = 1; T <= worst; T++){
    const v = comboAt(C, Wk, T);
    if(x.p50 === null && v >= .5) x.p50 = T;
    if(v >= .9){ x.p90 = T; break; }
  }
  if(x.p90 === null) x.p90 = worst;
  if(x.p50 === null) x.p50 = x.p90;
  return x;
}

/* Удача аккаунта: модель подстраивается так, чтобы среднее число круток на топ совпало
   с вашим, а шанс 50/50 — с вашей долей выигрышей. Это сценарий «если и дальше будет
   везти так же», а не прогноз: прошлые крутки на будущие не влияют. */
function scaledModel(base, s){ return { base: base.base * s, soft: base.soft, step: base.step * s, hard: base.hard }; }
function modelMean(m){
  let surv = 1, mean = 0;
  for(let i = 1; i <= m.hard; i++){ const p = pityRate(m, i); mean += surv * p * i; surv *= 1 - p; }
  return mean;
}
const luckCache = {};
function fitModel(name, target){
  const key = name + ":" + target.toFixed(2);
  if(luckCache[key]) return luckCache[key];
  const base = PITY_MODEL[name];
  let lo = Math.log(0.02), hi = Math.log(40);
  for(let it = 0; it < 50; it++){
    const mid = (lo + hi) / 2;
    if(modelMean(scaledModel(base, Math.exp(mid))) > target) lo = mid; else hi = mid;
  }
  return (luckCache[key] = scaledModel(base, Math.exp((lo + hi) / 2)));
}
function accountLuck(cfg){
  const acc = HA();
  if(!acc) return null;
  const b = bannerStats(acc, cfg.ch);
  const tops = resolveTops(acc, b);
  const done = tops.slice(1);            // первое выпадение могло начаться до выгрузки
  if(done.length < 3) return null;
  const avg = done.reduce((s, x) => s + x.pulls, 0) / done.length;
  // выигрыш «по умолчанию» (режим «неразмеченные считать выигрышем») — это допущение, а не данные;
  // разметка по стандартному пулу — уже данные
  const plays = done.filter(x => x.st === "lose" || (x.st === "win" && (!x.auto || x.src === "std")));
  const wins = plays.filter(x => x.st === "win").length;
  // по нескольким разметкам долю выигрышей слегка тянем к обычной, чтобы 2 из 2 не давали 100%
  const win = plays.length >= 3 ? Math.min(.95, Math.max(.05, (wins + 2 * cfg.win) / (plays.length + 2))) : cfg.win;
  return { m: fitModel(cfg.model, avg), win, avg, n: done.length, plays: plays.length, wins };
}
function oddsCfg(game, kind, luck){
  const base = ODDS[game][kind];
  const cfg = Object.assign({}, base, { m: PITY_MODEL[base.model], luck: null });
  if(luck === "acc"){
    const a = accountLuck(base);
    if(a){ cfg.m = a.m; cfg.win = a.win; cfg.luck = a; }
  }
  return cfg;
}

function oddsUI(game){
  if(!ui.odds || typeof ui.odds !== "object") ui.odds = {};
  const o = ui.odds[game] || (ui.odds[game] = {});
  if(["char","weap","both"].indexOf(o.kind) === -1) o.kind = "char";
  if(o.luck !== "acc") o.luck = "avg";
  if(typeof o.src !== "string") o.src = "";
  if(!o.man || typeof o.man !== "object"){
    o.man = {};
    // прежняя версия хранила ручной гарант одним полем — переносим на текущий вид
    if(typeof o.pity === "number" || typeof o.guar === "boolean") o.man[o.kind === "weap" ? "weap" : "char"] = { pity:o.pity, guar:o.guar };
    delete o.pity; delete o.guar;
  }
  return o;
}
// что известно из Истории: крутки с последнего топа и был ли он проигрышем 50/50
function oddsFromHistory(cfg){
  const acc = HA();
  if(!acc) return null;
  const b = bannerStats(acc, cfg.ch);
  if(!b.total) return { pity:0, guar:false, note:"в истории нет круток на этом баннере" };
  const tops = resolveTops(acc, b);
  const last = tops[tops.length - 1];
  return {
    pity: b.pity,
    guar: !!last && last.st === "lose",
    unknown: !!last && last.st === "none",
    note: "UID " + acc.uid + (b.last ? ", последняя крутка " + b.last.slice(0, 10).split("-").reverse().join(".") : "")
  };
}
function oddsState(o, kind, cfg){
  const hist = oddsFromHistory(cfg);
  const man = o.man[kind] || {};
  return {
    hist,
    pity: typeof man.pity === "number" ? man.pity : (hist ? hist.pity : 0),
    guar: typeof man.guar === "boolean" ? man.guar : !!(hist && hist.guar),
    manual: typeof man.pity === "number" || typeof man.guar === "boolean"
  };
}
function oddsLabel(cfg, k){
  const n = cfg.from + k - 1;
  return cfg.unit ? cfg.unit + n : "×" + k;
}
function oddsGoal(cfg, k){ return cfg.what + " " + oddsLabel(cfg, k); }
function oddsPct(v){
  const p = v * 100;
  if(p >= 99.95) return "≈100%";
  if(p > 0 && p < 0.1) return "<0,1%";
  return (p >= 10 ? Math.round(p) : Math.round(p * 10) / 10).toLocaleString("ru-RU") + "%";
}
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function renderOdds(){
  const sec = document.getElementById("oddsSection");
  const game = curNav();
  const cfgs = ODDS[game];
  sec.classList.toggle("hidden", !cfgs);
  if(!cfgs) return;
  const o = oddsUI(game);
  const g = G();
  const tw = TOP_WORD[game];
  const charName = game === "zzz" ? "агент" : "персонаж";
  const kinds = o.kind === "both" ? ["char", "weap"] : [o.kind];

  // что считаем
  const seg = document.getElementById("oddsKind");
  seg.innerHTML = "";
  [["char", cap(charName)], ["weap", cap(cfgs.weap.what)], ["both", cap(charName) + " + " + cfgs.weap.what]].forEach(x => {
    const b = document.createElement("button");
    b.className = o.kind === x[0] ? "on" : "";
    b.textContent = x[1];
    b.onclick = () => { o.kind = x[0]; saveUI(); renderOdds(); };
    seg.appendChild(b);
  });

  // запас круток: из выбранного типа или всех отслеживаемых
  const srcSel = document.getElementById("oddsSrc");
  const types = g.types || [];
  if(o.src && !types.some(t => t.id === o.src)) o.src = "";
  srcSel.innerHTML = '<option value="">все типы круток</option>' +
    types.map(t => '<option value="' + esc(t.id) + '"' + (t.id === o.src ? " selected" : "") + ">" + esc(t.name) + "</option>").join("");
  const stock = Math.floor(o.src ? typePulls(types.find(t => t.id === o.src)) : types.reduce((s, t) => s + typePulls(t), 0));
  const pullsIn = document.getElementById("oddsPulls");
  const pulls = typeof o.pulls === "number" ? o.pulls : stock;
  if(document.activeElement !== pullsIn) pullsIn.value = pulls;
  document.getElementById("oddsStockBtn").classList.toggle("hidden", typeof o.pulls !== "number");
  document.getElementById("oddsStockBtn").textContent = "↺ запас: " + stock;
  document.getElementById("oddsLuck").value = o.luck;

  // гарант по каждому баннеру: из истории, пока не поправили руками
  const cfg = {}, st = {};
  kinds.forEach(k => { cfg[k] = oddsCfg(game, k, o.luck); st[k] = oddsState(o, k, cfg[k]); });
  let rowsHtml = "", notes = [];
  kinds.forEach(k => {
    const c = cfg[k], s = st[k];
    const odds = Math.round(ODDS[game][k].win * 100) + "/" + Math.round(100 - ODDS[game][k].win * 100);
    rowsHtml += '<div class="pityrow" data-kind="' + k + '">' +
      '<span class="pk">' + (kinds.length > 1 ? cap(k === "char" ? charName : c.what) + ": " : "") + "круток после последнего " + tw.gen + "</span>" +
      '<span class="oddsrow"><input type="number" min="0" max="' + (c.m.hard - 1) + '" step="1" inputmode="numeric" value="' + s.pity + '" data-act="pity">' +
      '<button class="chip' + (s.guar ? " on" : "") + '" data-act="guar" title="Был ли проигран 50/50 на последнем ' + tw.loc + '">' +
      (s.guar ? "следующий гарантирован" : "следующий: " + odds) + "</button></span></div>";
    const who = kinds.length > 1 ? cap(k === "char" ? charName : c.what) + ": " : "";
    if(s.manual) notes.push(who + 'гарант задан вручную · <button class="linkbtn" data-act="reset" data-kind="' + k + '">взять из истории</button>');
    else if(s.hist) notes.push(who + "гарант из истории, " + esc(s.hist.note) + (s.hist.unknown ? " · последний " + tw.nom + " не размечен как выигрыш или проигрыш 50/50 — считаю, что гаранта нет" : ""));
    else notes.push(who + "историю круток этой игры ещё не загружали — укажите гарант вручную");
  });
  document.getElementById("oddsPityRows").innerHTML = rowsHtml;
  document.getElementById("oddsFrom").innerHTML = notes.join("<br>");

  // цель: копии персонажа и/или оружия
  const Kc = Math.min(cfgs.char.max, Math.max(1, +o.k || 1));
  const Kw = Math.min(cfgs.weap.max, Math.max(1, +o.kw || 1));
  const tg = document.getElementById("oddsTargets");
  tg.innerHTML = "";
  kinds.forEach(k => {
    const max = cfgs[k].max, curK = k === "char" ? Kc : Kw;
    const wrap = document.createElement("div");
    wrap.className = "oddsk";
    wrap.innerHTML = '<span class="lbl">' + (kinds.length > 1 ? cap(k === "char" ? charName : cfgs[k].what) : "Цель") + "</span>";
    const s = document.createElement("div");
    s.className = "seg";
    for(let i = 1; i <= max; i++){
      const b = document.createElement("button");
      b.className = i === curK ? "on" : "";
      b.textContent = oddsLabel(cfgs[k], i);
      b.onclick = () => { if(k === "char") o.k = i; else o.kw = i; saveUI(); renderOdds(); };
      s.appendChild(b);
    }
    wrap.appendChild(s);
    tg.appendChild(wrap);
  });

  // расчёт
  let main, cross, goalText, rows = [];
  if(o.kind !== "both"){
    const k = o.kind, K = k === "char" ? Kc : Kw;
    const r = oddsRun(cfg[k], st[k].pity, st[k].guar, pulls, K);
    main = r.atN[K]; cross = r.cross[K];
    goalText = oddsGoal(cfgs[k], K);
    for(let i = 1; i <= K; i++) rows.push({ label: oddsLabel(cfgs[k], i), v: r.atN[i], x: r.cross[i], cur: i === K });
  } else {
    const rc = oddsRun(cfg.char, st.char.pity, st.char.guar, 0, Kc);
    const rw = oddsRun(cfg.weap, st.weap.pity, st.weap.guar, 0, Kw);
    const C = rc.curve[Kc];
    const atC = pulls >= C.length ? 1 : C[pulls];
    rows.push({ label: oddsLabel(cfgs.char, Kc), v: pulls > 0 ? atC : 0, x: rc.cross[Kc], cur: false });
    for(let i = 1; i <= Kw; i++){
      const worst = rc.cross[Kc].p100 + rw.cross[i].p100;
      const x = comboCross(C, rw.curve[i], worst);
      const v = pulls > 0 ? comboAt(C, rw.curve[i], pulls) : 0;
      rows.push({ label: oddsLabel(cfgs.char, Kc) + " + " + oddsLabel(cfgs.weap, i), v, x, cur: i === Kw });
    }
    const last = rows[rows.length - 1];
    main = last.v; cross = last.x;
    goalText = oddsGoal(cfgs.char, Kc) + " и " + oddsGoal(cfgs.weap, Kw);
  }
  document.getElementById("oddsMain").innerHTML =
    '<span class="v num">' + oddsPct(main) + "</span>" +
    '<span class="t">шанс получить ' + goalText + " за " + fmt(pulls) + " " + pullWord(pulls) + "</span>";
  let ex = "Чтобы получить " + goalText + ": с шансом 50% нужно <b>" + fmt(cross.p50) + "</b> " + pullsNom(cross.p50) +
    ", с шансом 90% — <b>" + fmt(cross.p90) + "</b>, гарантированно — <b>" + fmt(cross.p100) + "</b>. ";
  ex += "В запасе " + fmt(pulls) + " — " + (
    pulls < cross.p50 ? "до 50% не хватает " + fmt(cross.p50 - pulls) + "." :
    pulls < cross.p90 ? "до 90% не хватает " + fmt(cross.p90 - pulls) + "." :
    pulls < cross.p100 ? "до гарантии не хватает " + fmt(cross.p100 - pulls) + "." :
    "этого хватает даже в худшем случае.");
  if(o.kind === "both") ex += " Считается, что сначала крутится " + charName + ", а остаток уходит на " + cfgs.weap.what + ".";
  document.getElementById("oddsExplain").innerHTML = ex;

  document.getElementById("oddsBody").innerHTML = rows.map(r =>
    "<tr" + (r.cur ? ' class="cur"' : "") + "><td>" + r.label + "</td>" +
    '<td class="pbar"><span class="bar"><i style="width:' + (r.v * 100).toFixed(1) + '%"></i></span><b>' + oddsPct(r.v) + "</b></td>" +
    "<td>" + fmt(r.x.p50) + "</td><td>" + fmt(r.x.p90) + "</td><td>" + fmt(r.x.p100) + "</td></tr>").join("");

  // пояснение к режиму удачи
  const ln = document.getElementById("oddsLuckNote");
  if(o.luck === "acc"){
    const parts = [], miss = [];
    kinds.forEach(k => {
      const L = cfg[k].luck, nm = cap(k === "char" ? (game === "zzz" ? "агенты" : "персонажи") : (game === "zzz" ? "амплификаторы" : game === "hsr" ? "конусы" : "оружие"));
      if(!L){ miss.push(nm.toLowerCase()); return; }
      parts.push("<b>" + nm + "</b>: в среднем " + fmtP(L.avg) + " круток на " + tw.nom + " вместо обычных " + fmtP(modelMean(PITY_MODEL[ODDS[game][k].model])) +
        " (по " + L.n + " выпадениям)" + (L.plays >= 3 ? ", 50/50 выиграно " + L.wins + " из " + L.plays : ", 50/50 — как у всех: размечено меньше трёх"));
    });
    let t = parts.length ? "Расчёт по удаче вашего аккаунта. " + parts.join("; ") + ". " : "";
    if(miss.length) t += "Для расчёта по аккаунту нужно хотя бы 3 " + tw.nom + " в истории баннера — " + miss.join(" и ") + " пока считаются как у всех. ";
    t += "Это сценарий «если и дальше будет везти так же»: игра не помнит прошлых круток, и реальные шансы на будущее у всех одинаковые.";
    ln.innerHTML = t;
    ln.classList.remove("hidden");
  } else ln.classList.add("hidden");
  document.getElementById("oddsNote").textContent = ODDS_NOTE[game];
}
function pullsNom(n){
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? "крутка" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "крутки" : "круток";
}
function pullWord(n){
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? "крутку" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "крутки" : "круток";
}
document.getElementById("oddsSrc").onchange = function(){ const o = oddsUI(curNav()); o.src = this.value; o.pulls = null; saveUI(); renderOdds(); };
document.getElementById("oddsLuck").onchange = function(){ oddsUI(curNav()).luck = this.value; saveUI(); renderOdds(); };
document.getElementById("oddsPulls").onchange = function(){
  const o = oddsUI(curNav());
  o.pulls = Math.max(0, Math.min(5000, Math.floor(+this.value || 0)));
  saveUI(); renderOdds();
};
document.getElementById("oddsStockBtn").onclick = () => { oddsUI(curNav()).pulls = null; saveUI(); renderOdds(); };
document.getElementById("oddsPityRows").addEventListener("change", e => {
  if(e.target.dataset.act !== "pity") return;
  const kind = e.target.closest(".pityrow").dataset.kind;
  const o = oddsUI(curNav());
  const hard = PITY_MODEL[ODDS[curNav()][kind].model].hard;
  const cur = oddsState(o, kind, ODDS[curNav()][kind]);
  o.man[kind] = { pity: Math.max(0, Math.min(hard - 1, Math.floor(+e.target.value || 0))), guar: cur.guar };
  saveUI(); renderOdds();
});
document.getElementById("oddsPityRows").addEventListener("click", e => {
  const b = e.target.closest('[data-act="guar"]');
  if(!b) return;
  const kind = b.closest(".pityrow").dataset.kind;
  const o = oddsUI(curNav());
  const cur = oddsState(o, kind, ODDS[curNav()][kind]);
  o.man[kind] = { pity: cur.pity, guar: !cur.guar };
  saveUI(); renderOdds();
});
document.getElementById("oddsFrom").addEventListener("click", e => {
  const b = e.target.closest('[data-act="reset"]');
  if(!b) return;
  delete oddsUI(curNav()).man[b.dataset.kind];
  saveUI(); renderOdds();
});
