"use strict";
/* ── выдвижное меню на узких экранах ── */
function closeSide(){
  document.body.classList.remove("menu-open");
  document.getElementById("burger").setAttribute("aria-expanded","false");
}
document.getElementById("burger").onclick = () => {
  const on = !document.body.classList.contains("menu-open");
  document.body.classList.toggle("menu-open", on);
  document.getElementById("burger").setAttribute("aria-expanded", on ? "true" : "false");
};
document.getElementById("scrim").onclick = closeSide;

/* ── навигация: игры и их разделы ── */
const NAV_GAMES = [
  { id:"gi",  name:"Genshin Impact",    hist:"hk4e",  views:["pulls","history","achievements"] },
  { id:"hsr", name:"Honkai: Star Rail", hist:"hkrpg", views:["pulls","history","achievements"] },
  { id:"zzz", name:"Zenless Zone Zero", hist:"nap",   views:["calendar","pulls","history","achievements"] }
];
const VIEW_NAMES = { calendar:"Календарь", pulls:"Крутки", history:"История", achievements:"Достижения" };
const VIEWS = { calendar:"viewCalendar", pulls:"viewPulls", history:"viewHistory", achievements:"viewAchievements" };
const PULL_MATCH = { gi:/genshin|геншин|гэншин/i, hsr:/star\s*rail|\bhsr\b|хср/i, zzz:/zenless|\bzzz\b|ззз|зенлес/i };
const PULL_DEFAULT = {
  gi:  [["Переплетающиеся судьбы",1],["Примогемы",160]],
  hsr: [["Особый проездной",1],["Звёздный нефрит",160]],
  zzz: [["Мастер-ленты",1],["Полихромы",160]]
};
function navGame(id){ return NAV_GAMES.find(x => x.id === id) || null; }
function curNav(){ return ui.game || "zzz"; }
function histGameKey(){ const g = navGame(curNav()); return g ? g.hist : null; }
function navByHist(h){ return NAV_GAMES.find(x => x.hist === h) || null; }
// игры из раздела «Крутки», созданные раньше, узнаём по названию и привязываем к встроенным
function pClaim(){
  let ch = false;
  NAV_GAMES.forEach(n => {
    if(pdata.games.some(x => x.key === n.id)) return;
    const g = pdata.games.find(x => !x.key && PULL_MATCH[n.id].test(x.name || ""));
    if(g){ g.key = n.id; ch = true; }
  });
  if(ch) pSave();
}
function pGameFor(key){
  pClaim();
  let g = pdata.games.find(x => x.key === key);
  if(!g){
    g = { id:uid(), key, name:navGame(key).name, patch:null, patches:[],
      types:[{ id:uid(), name:"Ивентовые", currencies:PULL_DEFAULT[key].map(c => ({ id:uid(), name:c[0], rate:c[1], amount:0 })) }] };
    pdata.games.push(g);
    pSave();
  }
  return g;
}
function customGames(){ return pdata.games.filter(x => !x.key); }

function renderSide(){
  pClaim();
  const game = curNav(), view = ui.tab;
  let h = "";
  const fold = navFold();
  NAV_GAMES.forEach(g => {
    const f = !!fold[g.id];
    h += '<div class="sgame' + (g.id === game ? " cur" : "") + (f ? " fold" : "") + '">' +
      '<button class="navhead" data-fold="' + g.id + '" aria-expanded="' + !f + '"><span>' + esc(g.name) + '</span><i class="caret">▸</i></button><div class="sitems">';
    g.views.forEach(v => {
      h += '<button class="navitem' + (g.id === game && v === view ? " on" : "") + '" data-game="' + g.id + '" data-view="' + v + '">' + VIEW_NAMES[v] + "</button>";
    });
    h += "</div></div>";
  });
  const fc = !!fold.custom;
  h += '<div class="sgame' + (/^c:/.test(game) ? " cur" : "") + (fc ? " fold" : "") + '">' +
    '<button class="navhead" data-fold="custom" aria-expanded="' + !fc + '"><span>Другие игры</span><i class="caret">▸</i></button><div class="sitems">';
  customGames().forEach(c => {
    h += '<button class="navitem' + (game === "c:" + c.id ? " on" : "") + '" data-game="c:' + esc(c.id) + '" data-view="pulls" title="Только калькулятор круток">' + esc(c.name) + "</button>";
  });
  h += '<button class="navadd" data-act="add">+ другая игра</button>' +
    '<div class="navform hidden" id="navForm"><input id="navGameName" placeholder="Название игры" maxlength="40">' +
    '<button class="mark sm" data-act="create">Создать</button></div>' +
    '<p class="navnote">Для своих игр доступен только калькулятор круток.</p></div></div>';
  document.getElementById("sideNav").innerHTML = h;
}
function navFold(){
  if(!ui.navFold || typeof ui.navFold !== "object") ui.navFold = {};
  return ui.navFold;
}
function navCreate(){
  const inp = document.getElementById("navGameName");
  const nm = inp && inp.value.trim();
  if(!nm){ if(inp) inp.focus(); return; }
  const g = { id:uid(), name:nm, patch:null, patches:[],
    types:[{ id:uid(), name:"Обычные", currencies:[{ id:uid(), name:"Крутки", rate:1, amount:0 }] }] };
  pdata.games.push(g);
  pSave();
  setNav("c:" + g.id, "pulls");
}
document.getElementById("sideNav").addEventListener("click", e => {
  const t = e.target.closest("button");
  if(!t) return;
  if(t.dataset.fold){
    const f = navFold(), k = t.dataset.fold;
    if(f[k]) delete f[k]; else f[k] = 1;
    saveUI();
    renderSide();
    return;
  }
  if(t.dataset.act === "add"){
    const f = document.getElementById("navForm");
    f.classList.remove("hidden");
    t.classList.add("hidden");
    document.getElementById("navGameName").focus();
    return;
  }
  if(t.dataset.act === "create"){ navCreate(); return; }
  if(t.dataset.game) setNav(t.dataset.game, t.dataset.view);
});
document.getElementById("sideNav").addEventListener("keydown", e => {
  if(e.target.id !== "navGameName") return;
  if(e.key === "Enter") navCreate();
  if(e.key === "Escape") renderSide();
});

function setNav(game, view){
  const ng = navGame(game);
  let cg = null;
  if(!ng){
    const id = String(game || "").replace(/^c:/, "");
    cg = customGames().find(x => x.id === id);
    if(!cg){ game = "zzz"; view = view || "calendar"; }
    else view = "pulls";
  }
  const nav = navGame(game);
  if(nav && nav.views.indexOf(view) === -1) view = nav.views.indexOf("pulls") !== -1 ? "pulls" : nav.views[0];
  const changed = ui.game !== game;
  ui.game = game;
  ui.tab = view;
  Object.keys(VIEWS).forEach(v => document.getElementById(VIEWS[v]).classList.toggle("hidden", v !== view));
  document.body.classList.remove("tab-calendar","tab-pulls","tab-history","tab-achievements","game-gi","game-hsr","game-zzz","game-custom");
  document.body.classList.add("tab-" + view, cg ? "game-custom" : "game-" + game);
  closeMenu(); closePick(); closePatchPick(); closeGamePick(); closeSide();
  if(view === "pulls"){
    pdata.active = (cg || pGameFor(game)).id;
    pSave();
    renderPulls();
  } else if(view === "history"){
    if(changed){ histBanner = null; histPage = 0; }
    renderHistory(); readWatched(false);
  } else if(view === "achievements"){
    AS.game = game;
    aLimit = 120;
    renderAch();
  } else {
    document.getElementById("hTitle").childNodes[0].nodeValue = "Ежедневные награды";
    document.getElementById("hSub").textContent = "Zenless Zone Zero";
    render();                          // графики подстраиваются под ширину видимого раздела
  }
  saveUI();
  renderSide();
}
function setView(name){ setNav(curNav(), name); }
// при повороте телефона или смене ширины окна перерисовываем текущий раздел — графики и подписи
let navW = window.innerWidth, navWT = 0;
window.addEventListener("resize", () => {
  clearTimeout(navWT);
  navWT = setTimeout(() => {
    if(Math.abs(window.innerWidth - navW) < 40) return;
    navW = window.innerWidth;
    setNav(curNav(), ui.tab);
  }, 250);
});
// прежние версии запоминали только раздел — догадываемся, какая игра была открыта
(function migrateNav(){
  if(ui.game) return;
  if(ui.tab === "achievements" && navGame(AS.game)) ui.game = AS.game;
  else if(ui.tab === "history"){
    const a = hdata.accounts.find(x => x.key === hdata.active);
    const n = a && navByHist(a.game);
    ui.game = n ? n.id : "zzz";
  } else if(ui.tab === "pulls"){
    pClaim();
    const g = pdata.games.find(x => x.id === pdata.active);
    ui.game = g ? (g.key || "c:" + g.id) : "zzz";
  } else ui.game = "zzz";
})();

setInterval(() => { if(refreshToday()) render(); }, 60000);
document.addEventListener("visibilitychange", () => {
  if(document.hidden) return;
  if(refreshToday()) render();
  if(document.body.classList.contains("tab-history")) readWatched(false);
});

render();
setNav(curNav(), ui.tab || "calendar");
restoreWatch();
