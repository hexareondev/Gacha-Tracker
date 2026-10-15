"use strict";
/* ── резервные копии ── */
function note(msg){ document.getElementById("storeNote").textContent = msg; }

function merge(text){
  let inc;
  try { inc = JSON.parse(text); } catch(e){ inc = null; }
  if(!inc || typeof inc !== "object"){
    note("Данные не читаются — нужен JSON из этого же трекера.");
    return false;
  }
  if(inc.v >= 2 || inc.rewards){
    if(inc.pulls && inc.pulls.games){ pdata = inc.pulls; pSave(); renderPulls(); }
    if(inc.gacha && inc.gacha.accounts){ hdata = inc.gacha; hSave(); renderHistory(); }
    if(inc.ach && typeof inc.ach === "object"){
      // отметки достижений объединяем: из копии добавляется то, чего здесь нет
      Object.keys(inc.ach).forEach(gid => {
        const src = inc.ach[gid];
        if(!src || typeof src !== "object") return;
        const m = aDoneMap(gid);
        Object.keys(src).forEach(id => { if(src[id] && !m[id]) m[id] = src[id]; });
      });
      aSave();
      if(ui.tab === "achievements") renderAch();
    }
    inc = inc.rewards || {};
  }
  let added = 0, upd = 0;
  for(const k in inc){
    const e = inc[k];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    if(!e || ["p","d","m"].indexOf(e.t) === -1 || typeof e.v !== "number") continue;
    if(data[k]) upd++; else added++;
    data[k] = { t:e.t, v:e.v };
  }
  if(!added && !upd){ note("Данные загружены (новых дней в календаре нет)."); store.save(data); render(); return true; }
  store.save(data);
  render();
  note("Загружено. Новых дней: " + added + ", обновлено: " + upd + ".");
  return true;
}

document.getElementById("export").onclick = () => {
  const text = JSON.stringify({ v:3, rewards:data, pulls:pdata, gacha:hdata, ach:adata }, null, 1);
  const name = "zzz-rewards-" + todayKey + ".json";
  try {
    const blob = new Blob([text], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
    note("Файл " + name + " ушёл в загрузки. Не нашли его — откройте «Показать данные текстом».");
  } catch(err){
    openData();
    note("Скачивание заблокировано браузером. Скопируйте данные из окна вручную.");
  }
};

document.getElementById("importBtn").onclick = () => document.getElementById("importFile").click();
document.getElementById("importFile").onchange = function(){
  const f = this.files[0];
  if(!f){ return; }
  const r = new FileReader();
  r.onload = () => merge(r.result);
  r.onerror = () => note("Файл не прочитался. Попробуйте вставить его содержимое текстом.");
  r.readAsText(f);
  this.value = "";
};

function openData(){
  closeMenu();
  const t = document.getElementById("dataText");
  t.value = JSON.stringify({ v:3, rewards:data, pulls:pdata, gacha:hdata, ach:adata }, null, 1);
  document.getElementById("dataOverlay").classList.add("on");
  t.focus();
  t.select();
}
function closeData(){ document.getElementById("dataOverlay").classList.remove("on"); }

document.getElementById("impApply").onclick = applyImport;
function closeImport(){
  pending = null;
  document.getElementById("importOverlay").classList.remove("on");
}
document.getElementById("impCancel").onclick = closeImport;
document.getElementById("importOverlay").addEventListener("mousedown", e => {
  if(e.target.id === "importOverlay") closeImport();
});

document.getElementById("showJson").onclick = openData;
document.getElementById("closeData").onclick = closeData;
document.getElementById("dataOverlay").addEventListener("mousedown", e => {
  if(e.target.id === "dataOverlay") closeData();
});
document.getElementById("copyJson").onclick = function(){
  const t = document.getElementById("dataText");
  t.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch(e){ ok = false; }
  if(!ok && navigator.clipboard){
    navigator.clipboard.writeText(t.value).then(
      () => { this.textContent = "Скопировано"; },
      () => { this.textContent = "Скопируйте вручную"; }
    );
    return;
  }
  this.textContent = ok ? "Скопировано" : "Скопируйте вручную";
  setTimeout(() => { this.textContent = "Скопировать"; }, 2000);
};
document.getElementById("applyJson").onclick = () => {
  if(merge(document.getElementById("dataText").value)) closeData();
};
