"use strict";
const POLY  = [10,20,40,60];
const DENNY = [2888,5888,8888,12888];
const MASTER = [3];
const GUAR  = [3,8,15,20,27];
const KEY   = "zzz-daily-rewards-v1";
const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const MONTHS_IN = ["январе","феврале","марте","апреле","мае","июне","июле","августе","сентябре","октябре","ноябре","декабре"];

/* ── хранилище: localStorage, с запасным вариантом в памяти ── */
function makeStore(key){
  let ok = false;
  try { localStorage.setItem("__t","1"); localStorage.removeItem("__t"); ok = true; } catch(e){ ok = false; }
  let mem = {};
  return {
    persistent: ok,
    load(){
      if(!ok) return mem;
      try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch(e){ return {}; }
    },
    save(d){
      mem = d;
      if(ok){ try { localStorage.setItem(key, JSON.stringify(d)); } catch(e){} }
    }
  };
}
const store = makeStore(KEY);
const ustore = makeStore("zzz-ui-v1");
const ui = ustore.load() || {};
function saveUI(){ ustore.save(ui); }
// смена игрового дня: сколько минут после полуночи по местному времени
function resetMin(){ return typeof ui.resetMin === "number" ? ui.resetMin : 0; }
function gameNow(){ return new Date(Date.now() - resetMin() * 60000); }

let data = store.load();
let now = gameNow();
let todayKey = iso(now.getFullYear(), now.getMonth(), now.getDate());
// вкладка может висеть открытой через смену дня — сверяем дату заново
function refreshToday(){
  const d = gameNow();
  const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
  now = d;
  if(k === todayKey) return false;
  todayKey = k;
  return true;
}
let view = { y: now.getFullYear(), m: now.getMonth() };
let picking = null;
let keyMap = {};
let recLimit = typeof ui.recLimit === "number" ? ui.recLimit : 10;
let recPage = 0;
let recMode = ui.recMode === "year" ? "year" : "month";
let recSort = (ui.recSort && ui.recSort.key) ? ui.recSort : { key:"poly", dir:-1 };

/* ── утилиты ── */
function pad(n){ return n < 10 ? "0"+n : ""+n; }
function iso(y,m,d){ return y+"-"+pad(m+1)+"-"+pad(d); }
function daysIn(y,m){ return new Date(y, m+1, 0).getDate(); }
function firstDow(y,m){ return (new Date(y,m,1).getDay()+6)%7; }
function isGuar(d){ return GUAR.indexOf(d) !== -1; }
function fmt(n){ return n.toLocaleString("ru-RU"); }
function fmtK(n){ return n >= 1000 ? Math.round(n/1000)+"k" : ""+n; }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function polyTier(v){ return v >= 60 ? 4 : v >= 40 ? 3 : v >= 20 ? 2 : 1; }

function sumRange(pred){
  let p = 0, d = 0, mt = 0, days = 0;
  for(const k in data){
    if(!pred(k)) continue;
    const e = data[k];
    if(e.t === "p"){ p += e.v; }
    else if(e.t === "m"){ mt += e.v; }
    else { d += e.v; }
    days++;
  }
  return { poly:p, denny:d, master:mt, days:days };
}
function monthStats(y,m){ const pre = y+"-"+pad(m+1)+"-"; return sumRange(k => k.indexOf(pre) === 0); }
function yearStats(y){ const pre = y+"-"; return sumRange(k => k.indexOf(pre) === 0); }
