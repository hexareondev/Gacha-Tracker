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
   сколько нужных копий уже выпало (последнее значение поглощающее). */
function oddsRun(cfg, pity, guar, pulls, K){
  const m = PITY_MODEL[cfg.model], H = m.hard;
  const S = (K + 1) * 2 * H;
  let cur = new Float64Array(S), nxt = new Float64Array(S);
  const at = (c, g, j) => (c * 2 + g) * H + j;
  cur[at(0, guar ? 1 : 0, Math.min(Math.max(0, pity), H - 1))] = 1;
  const reach = [];                  // reach[k] — вероятность иметь ≥k копий после каждой крутки
  for(let k = 0; k <= K; k++) reach.push([k ? 0 : 1]);
  let worst = (H - pity) + (guar ? 0 : H) + (K - 1) * 2 * H;
  const steps = Math.max(pulls, worst);
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
    // P(≥k) = масса во всех состояниях с c ≥ k
    let acc = 0;
    for(let c = K; c >= 1; c--){
      for(let j = 0; j < 2 * H; j++) acc += cur[c * 2 * H + j];
      const v = Math.min(1, acc);
      if(n === pulls) atN[c] = v;
      const x = cross[c];
      if(x.p50 === null && v >= .5) x.p50 = n;
      if(x.p90 === null && v >= .9) x.p90 = n;
    }
  }
  if(pulls <= 0) for(let c = 1; c <= K; c++) atN[c] = 0;
  // «наверняка» — худший случай по правилам гаранта, а не по численной точности
  for(let c = 1; c <= K; c++) cross[c].p100 = (H - pity) + (guar ? 0 : H) + (c - 1) * 2 * H;
  return { atN, cross };
}

function oddsUI(game){
  if(!ui.odds || typeof ui.odds !== "object") ui.odds = {};
  const o = ui.odds[game] || (ui.odds[game] = {});
  if(o.kind !== "weap") o.kind = "char";
  if(typeof o.src !== "string") o.src = "";
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
    note: "из истории: UID " + acc.uid + (b.last ? ", последняя крутка " + b.last.slice(0, 10).split("-").reverse().join(".") : "")
  };
}
function oddsLabel(cfg, k){
  const n = cfg.from + k - 1;
  return cfg.unit ? cfg.unit + n : k + " шт.";
}
function oddsPct(v){
  const p = v * 100;
  if(p >= 99.95) return "≈100%";
  if(p > 0 && p < 0.1) return "<0,1%";
  return (p >= 10 ? Math.round(p) : Math.round(p * 10) / 10).toLocaleString("ru-RU") + "%";
}

function renderOdds(){
  const sec = document.getElementById("oddsSection");
  const game = curNav();
  const cfgs = ODDS[game];
  sec.classList.toggle("hidden", !cfgs);
  if(!cfgs) return;
  const o = oddsUI(game);
  const cfg = cfgs[o.kind];
  const g = G();

  // вид баннера
  const seg = document.getElementById("oddsKind");
  seg.innerHTML = "";
  [["char", game === "zzz" ? "Агент" : "Персонаж"], ["weap", cfgs.weap.what[0].toUpperCase() + cfgs.weap.what.slice(1)]].forEach(x => {
    const b = document.createElement("button");
    b.className = o.kind === x[0] ? "on" : "";
    b.textContent = x[1];
    b.onclick = () => { o.kind = x[0]; o.pity = null; o.guar = null; saveUI(); renderOdds(); };
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

  // гарант: из истории, пока не поправили руками
  const hist = oddsFromHistory(cfg);
  const pity = typeof o.pity === "number" ? o.pity : (hist ? hist.pity : 0);
  const guar = typeof o.guar === "boolean" ? o.guar : !!(hist && hist.guar);
  const pityIn = document.getElementById("oddsPity");
  pityIn.max = PITY_MODEL[cfg.model].hard - 1;
  if(document.activeElement !== pityIn) pityIn.value = pity;
  const gb = document.getElementById("oddsGuar");
  gb.classList.toggle("on", guar);
  const tw = TOP_WORD[game];
  document.getElementById("oddsPityLbl").textContent = "Круток после последнего " + tw.gen;
  const odds = Math.round(cfg.win * 100) + "/" + Math.round(100 - cfg.win * 100);
  gb.textContent = guar ? "Следующий " + tw.nom + " гарантирован" : "Следующий " + tw.nom + ": " + odds;
  gb.title = "Нажмите, чтобы переключить: был ли проигран 50/50 на последнем " + tw.loc;
  const manual = typeof o.pity === "number" || typeof o.guar === "boolean";
  let srcNote;
  if(manual) srcNote = 'Гарант задан вручную · <button class="linkbtn" id="oddsReset">взять из истории</button>';
  else if(hist) srcNote = "Гарант " + esc(hist.note) + (hist.unknown ? " · последний " + TOP_WORD[game].nom + " не размечен в истории как выигрыш или проигрыш 50/50 — считаю, что гаранта нет" : "");
  else srcNote = "Историю круток этой игры ещё не загружали — укажите гарант вручную.";
  document.getElementById("oddsFrom").innerHTML = srcNote;
  const rb = document.getElementById("oddsReset");
  if(rb) rb.onclick = () => { o.pity = null; o.guar = null; saveUI(); renderOdds(); };

  // копий
  const K = Math.min(cfg.max, Math.max(1, +o.k || 1));
  const ks = document.getElementById("oddsCopies");
  ks.innerHTML = "";
  for(let k = 1; k <= cfg.max; k++){
    const b = document.createElement("button");
    b.className = k === K ? "on" : "";
    b.textContent = oddsLabel(cfg, k);
    b.onclick = () => { o.k = k; saveUI(); renderOdds(); };
    ks.appendChild(b);
  }

  const r = oddsRun(cfg, pity, guar, pulls, K);
  const main = r.atN[K];
  document.getElementById("oddsMain").innerHTML =
    '<span class="v num">' + oddsPct(main) + "</span>" +
    '<span class="t">шанс получить ' + (K === 1 ? cfg.what : cfg.what + " до " + oddsLabel(cfg, K)) + " за " + fmt(pulls) + " " + pullWord(pulls) + "</span>";
  // то же самое словами: сколько круток нужно и сколько не хватает
  const cx = r.cross[K], goal = K === 1 && cfg.from === 0 ? cfg.what + " (" + oddsLabel(cfg, K) + ")" : oddsLabel(cfg, K);
  let ex = "Чтобы получить " + goal + ": с шансом 50% нужно <b>" + fmt(cx.p50) + "</b> " + pullsNom(cx.p50) +
    ", с шансом 90% — <b>" + fmt(cx.p90) + "</b>, гарантированно — <b>" + fmt(cx.p100) + "</b>. ";
  ex += "В запасе " + fmt(pulls) + " — " + (
    pulls < cx.p50 ? "до 50% не хватает " + fmt(cx.p50 - pulls) + "." :
    pulls < cx.p90 ? "до 90% не хватает " + fmt(cx.p90 - pulls) + "." :
    pulls < cx.p100 ? "до гарантии не хватает " + fmt(cx.p100 - pulls) + "." :
    "этого хватает даже в худшем случае.");
  document.getElementById("oddsExplain").innerHTML = ex;
  let rows = "";
  for(let k = 1; k <= K; k++){
    const x = r.cross[k], v = r.atN[k];
    rows += "<tr" + (k === K ? ' class="cur"' : "") + "><td>" + oddsLabel(cfg, k) + "</td>" +
      '<td class="pbar"><span class="bar"><i style="width:' + (v * 100).toFixed(1) + '%"></i></span><b>' + oddsPct(v) + "</b></td>" +
      "<td>" + fmt(x.p50) + "</td><td>" + fmt(x.p90) + "</td><td>" + fmt(x.p100) + "</td></tr>";
  }
  document.getElementById("oddsBody").innerHTML = rows;
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
document.getElementById("oddsPulls").onchange = function(){
  const o = oddsUI(curNav());
  o.pulls = Math.max(0, Math.min(5000, Math.floor(+this.value || 0)));
  saveUI(); renderOdds();
};
document.getElementById("oddsStockBtn").onclick = () => { oddsUI(curNav()).pulls = null; saveUI(); renderOdds(); };
document.getElementById("oddsPity").onchange = function(){
  const o = oddsUI(curNav());
  const cfg = ODDS[curNav()][o.kind];
  o.pity = Math.max(0, Math.min(PITY_MODEL[cfg.model].hard - 1, Math.floor(+this.value || 0)));
  saveUI(); renderOdds();
};
document.getElementById("oddsGuar").onclick = function(){
  const o = oddsUI(curNav());
  o.guar = !this.classList.contains("on");
  saveUI(); renderOdds();
};
