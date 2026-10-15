"use strict";
/* ── настройки: время смены дня ── */
const SERVERS = [
  { id:"asia", name:"Азия · 04:00 (UTC+8)",    off: 8 * 60 },
  { id:"eu",   name:"Европа · 04:00 (UTC+1)",  off: 1 * 60 },
  { id:"us",   name:"Америка · 04:00 (UTC−5)", off: -5 * 60 }
];
function localReset(serverOff){
  const localOff = -new Date().getTimezoneOffset();
  return ((4 * 60 - serverOff + localOff) % 1440 + 1440) % 1440;
}
function hhmm(min){
  return String(Math.floor(min / 60)).padStart(2,"0") + ":" + String(min % 60).padStart(2,"0");
}
function renderIconSettings(){
  const sel = document.getElementById("iconMode");
  const hide = iconMode() === "off" || iconMode() === "auto";
  document.getElementById("iconTplRow").classList.toggle("hidden", hide);
  document.getElementById("iconTplRow2").classList.toggle("hidden", hide);
  const inp = document.getElementById("iconTpl");
  const inp2 = document.getElementById("iconTplItem");
  sel.value = iconMode();
  if(document.activeElement !== inp) inp.value = ui.iconTpl || LOCAL_TPL;
  if(document.activeElement !== inp2) inp2.value = ui.iconTplItem || ui.iconTpl || LOCAL_TPL;
  const reset = () => {
    ui.iconPick = {}; ui.iconOk = {};
    Object.keys(iconMiss).forEach(k => { delete iconMiss[k]; });
    saveUI();
    if(document.body.classList.contains("tab-history")) renderHistory();
    renderIconSettings();
  };
  sel.onchange = () => { ui.iconMode = sel.value; reset(); };
  inp.onchange = () => { ui.iconTpl = inp.value.trim() || LOCAL_TPL; reset(); };
  inp2.onchange = () => { ui.iconTplItem = inp2.value.trim() || LOCAL_TPL; reset(); };
  document.getElementById("iconReset").onclick = () => {
    ui.iconIdx = {}; ui.iconIdxAt = {};
    Object.keys(idxRefreshed).forEach(k => { delete idxRefreshed[k]; });
    Object.keys(idxFailed).forEach(k => { delete idxFailed[k]; });
    reset();
  };

  // диагностика: что именно сработало
  const box = document.getElementById("iconDiag");
  box.innerHTML = "";
  if(iconMode() === "off"){ return; }
  const names = { hkrpg:"Star Rail", nap:"Zenless Zone Zero", hk4e:"Genshin" };
  const kinds = { char:"персонажи", item:"предметы" };
  const lines = [];
  Object.keys(names).forEach(g => {
    Object.keys(kinds).forEach(k => {
      const slot = g + ":" + k;
      const idx = (ui.iconIdx || {})[slot];
      const ok = (ui.iconOk || {})[slot];
      if(!idx && !ok && !idxFailed[slot] && !idxLoading[slot]) return;
      const needIdx = (((ICON_IDX[g] || {})[k] || []).length > 0);
      const idxPart = !needIdx ? "адрес строится по коду предмета. "
        : idx && Object.keys(idx).length ? "в справочнике " + Object.keys(idx).length + " записей" +
            ((ui.iconIdxAt || {})[slot] ? " от " + new Date(ui.iconIdxAt[slot]).toLocaleDateString("ru-RU") : "") + ". "
        : idxFailed[slot] ? "справочник не загрузился. "
        : "справочник ещё загружается. ";
      lines.push("<b>" + names[g] + " · " + kinds[k] + ":</b> " + idxPart +
        (ok ? '<span class="ok">картинки берутся с ' + esc(ok) + "</span>" : "рабочий адрес пока не найден"));
    });
  });
  const noIdx = lines.length && lines.some(l => l.indexOf("не загрузился") !== -1);
  box.innerHTML = lines.length
    ? lines.join("<br>") +
      (noIdx ? "<br>Справочник не загрузился — скорее всего база не отдаёт данные в браузер. Тогда помогает режим «свой адрес» или папка рядом с сайтом." : "")
    : "Откройте раздел «История круток» — приложение переберёт источники и покажет здесь, какой сработал.";
}

function renderSettings(){
  renderIconSettings();
  const sel = document.getElementById("resetPreset");
  sel.innerHTML = SERVERS.map(s => '<option value="' + s.id + '">' + s.name + " → " + hhmm(localReset(s.off)) + " у вас</option>").join("") +
    '<option value="custom">Своё время</option>';
  sel.value = ui.resetPreset || "custom";
  document.getElementById("resetTime").value = hhmm(resetMin());

  const real = new Date();
  const g = gameNow();
  let left = (resetMin() - (real.getHours() * 60 + real.getMinutes()) + 1440) % 1440;
  if(left === 0) left = 1440;
  document.getElementById("resetInfo").textContent =
    "Сейчас идёт игровой день " + g.getDate() + " " + MONTHS[g.getMonth()].toLowerCase() +
    ", до смены " + Math.floor(left / 60) + " ч " + (left % 60) + " мин.";
}
function applyReset(min, preset){
  ui.resetMin = ((min % 1440) + 1440) % 1440;
  ui.resetPreset = preset;
  saveUI();
  refreshToday();
  render();
  renderSettings();
}
document.getElementById("openSettings").onclick = () => {
  closeMenu();
  renderSettings();
  document.getElementById("settingsOverlay").classList.add("on");
};
function closeSettings(){ document.getElementById("settingsOverlay").classList.remove("on"); }
document.getElementById("closeSettings").onclick = closeSettings;
document.getElementById("settingsOverlay").addEventListener("mousedown", e => {
  if(e.target.id === "settingsOverlay") closeSettings();
});
document.getElementById("resetPreset").onchange = function(){
  const s = SERVERS.find(x => x.id === this.value);
  if(s) applyReset(localReset(s.off), s.id);
  else applyReset(resetMin(), "custom");
};
document.getElementById("resetTime").onchange = function(){
  const m = /^(\d{2}):(\d{2})$/.exec(this.value);
  if(!m){ this.value = hhmm(resetMin()); return; }
  applyReset(+m[1] * 60 + +m[2], "custom");
};

let pickY = view.y;
function pickOpen(){ return document.getElementById("monthPicker").classList.contains("on"); }
function closePick(){
  document.getElementById("monthPicker").classList.remove("on");
  document.getElementById("monthLabel").setAttribute("aria-expanded","false");
}
function renderPick(){
  document.getElementById("pickYear").textContent = pickY;
  const grid = document.getElementById("pickGrid");
  grid.innerHTML = "";
  for(let m = 0; m < 12; m++){
    const st = monthStats(pickY, m);
    const b = document.createElement("button");
    let cls = "";
    if(pickY === view.y && m === view.m) cls += " cur";
    if(st.days) cls += " has";
    if(pickY > now.getFullYear() || (pickY === now.getFullYear() && m > now.getMonth())) cls += " fut";
    b.className = cls.trim();
    b.textContent = MONTHS_SHORT[m];
    b.title = st.days ? st.poly + " полихромов · отмечено дней: " + st.days : "нет отметок";
    b.onclick = () => { view = { y:pickY, m:m }; closePick(); render(); };
    grid.appendChild(b);
  }
}
document.getElementById("monthLabel").onclick = e => {
  e.stopPropagation();
  closeMenu();
  const on = !pickOpen();
  if(on){ pickY = view.y; renderPick(); }
  document.getElementById("monthPicker").classList.toggle("on", on);
  document.getElementById("monthLabel").setAttribute("aria-expanded", on ? "true" : "false");
};
document.getElementById("pickPrevY").onclick = () => { pickY--; renderPick(); };
document.getElementById("pickNextY").onclick = () => { pickY++; renderPick(); };

/* ── меню данных ── */
function menuOpen(){ return document.getElementById("menu").classList.contains("on"); }
function closeMenu(){
  document.getElementById("menu").classList.remove("on");
  document.getElementById("menuBtn").setAttribute("aria-expanded","false");
}
document.getElementById("menuBtn").onclick = e => {
  e.stopPropagation();
  closePick();
  const on = !menuOpen();
  document.getElementById("menu").classList.toggle("on", on);
  document.getElementById("menuBtn").setAttribute("aria-expanded", on ? "true" : "false");
};
document.addEventListener("mousedown", e => {
  if(menuOpen() && !e.target.closest(".menuwrap")) closeMenu();
  if(pickOpen() && !e.target.closest(".pickwrap")) closePick();
  if(patchPickOpen() && !e.target.closest(".pickwrap")) closePatchPick();
  if(gamePickOpen() && !e.target.closest(".pickwrap")) closeGamePick();
});

/* ── подтверждение очистки ── */
function daysWord(n){
  const t = n % 100, o = n % 10;
  if(t > 10 && t < 20) return "дней";
  if(o === 1) return "день";
  if(o > 1 && o < 5) return "дня";
  return "дней";
}
let confirmCb = null;
function askConfirm(title, text, btn, cb, withBackup){
  confirmCb = cb;
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmText").textContent = text;
  document.getElementById("confirmYes").textContent = btn;
  document.getElementById("backupFirst").classList.toggle("hidden", !withBackup);
  document.getElementById("confirmOverlay").classList.add("on");
  document.getElementById("confirmNo").focus();
}
document.getElementById("reset").onclick = () => {
  closeMenu();
  const n = Object.keys(data).length;
  if(!n){ openMenuNote("История пуста — удалять нечего."); return; }
  askConfirm("Очистить историю?",
    "Будет стёрто " + n + " отмеченных " + daysWord(n) + " за всё время. Вернуть их будет нельзя.",
    "Удалить " + n + " " + daysWord(n),
    () => { data = {}; store.save(data); render(); openMenuNote("История очищена."); },
    true);
};
function closeConfirm(){ document.getElementById("confirmOverlay").classList.remove("on"); }
document.getElementById("confirmNo").onclick = closeConfirm;
document.getElementById("confirmYes").onclick = () => {
  const cb = confirmCb;
  confirmCb = null;
  closeConfirm();
  if(cb) cb();
};
document.getElementById("backupFirst").onclick = () => document.getElementById("export").click();
document.getElementById("confirmOverlay").addEventListener("mousedown", e => {
  if(e.target.id === "confirmOverlay") closeConfirm();
});

function openMenuNote(msg){
  note(msg);
  document.getElementById("menu").classList.add("on");
  document.getElementById("menuBtn").setAttribute("aria-expanded","true");
}

if(!store.persistent){
  document.getElementById("storeNote").textContent =
    "Этот просмотр без постоянного хранилища: отметки пропадут при перезагрузке. На GitHub Pages всё сохраняется в браузере.";
}
