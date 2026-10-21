"use strict";
/* ── витрина: сборки персонажей из профиля игры через Enka.Network ──
   Enka читает только то, что игрок выставил в витрину профиля. Каждый ответ сохраняется,
   поэтому со временем копится сборка всех персонажей, которых вы когда-либо показывали.
   Для каждой игры есть «переводчик» ответа Enka в общую модель карточки (vm), а отрисовка общая. */

const enkaStore = makeStore("zzz-enka-v1");
let enkaData = enkaStore.load();
if(!enkaData || typeof enkaData !== "object") enkaData = {};
// раньше хранилась только ZZZ — ключом был голый UID
Object.keys(enkaData).forEach(k => { if(/^\d+$/.test(k)){ enkaData["nap:" + k] = enkaData[k]; delete enkaData[k]; } });
function enkaSave(){ enkaStore.save(enkaData); }

const SCB = {}, scbLoading = {};
function ensureBuild(game, cb){
  if(SCB[game]){ cb && cb(); return; }
  if(scbLoading[game]) return;
  scbLoading[game] = true;
  fetch("items/data/" + game + "_build.json", { cache:"no-cache" }).then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => { SCB[game] = j; cb && cb(); })
    .catch(() => { const n = document.getElementById("scNote"); if(n) n.textContent = "Не удалось загрузить справочник характеристик."; })
    .finally(() => { scbLoading[game] = false; });
}
const ru = () => nameLang() !== "en";
function fInt(v){ return Math.floor(v).toLocaleString("ru-RU"); }
function fPct(v, d){ const k = Math.pow(10, d === undefined ? 1 : d); return (Math.round(v * k) / k).toLocaleString("ru-RU") + "%"; }
function scList(x){
  if(Array.isArray(x)) return x;
  if(x && typeof x === "object") return Object.keys(x).map(k => typeof x[k] === "object" ? x[k] : { Index:Number(k), Level:x[k] });
  return [];
}
function scItemName(game, id){ const db = itemsDb[game]; const it = db && db.items[String(id)]; return it ? dbName(it) : ""; }
function scLoc(o){ return o ? (ru() ? o.n || o.en : o.en || o.n) : ""; }

/* ════════════ Zenless Zone Zero ════════════ */
const ZZZ_EL = {
  Fire:{ n:"Огонь", c:"#ff6a3d" }, Ice:{ n:"Лёд", c:"#8fdcff" }, Elec:{ n:"Электро", c:"#4f9dff" },
  Physics:{ n:"Физ.", c:"#f2c14e" }, Ether:{ n:"Эфир", c:"#ff4fd2" }, Wind:{ n:"Ветер", c:"#4fe3b0" }, Lumen:{ n:"Люмен", c:"#ffe98a" },
  FireFrost:{ n:"Мороз", base:"Ice", c:"#4cc4ea" }, AuricEther:{ n:"Аура-тушь", base:"Ether", c:"#e8a93c" }, ZhenZhenAssault:{ n:"Остриё", base:"Physics", c:"#8c8cff" }
};
function zzzElement(list){
  list = list || [];
  const key = list.find(e => ZZZ_EL[e] && ZZZ_EL[e].base) || list[0] || "";
  const e = ZZZ_EL[key];
  if(!e) return { n:key, c:"#f0c264", k:key };
  return { n:e.n, c:e.c || ZZZ_EL[e.base].c, k:key };
}
const ZZZ_PRO = { Attack:"Нападение", Stun:"Устрашение", Anomaly:"Аномалия", Support:"Поддержка", Defense:"Оборона", Rupture:"Разрушение", Armorer:"Оружейник" };
const ZZZ_SKILL = { 0:"Обычная атака", 1:"Особая атака", 2:"Уклонение", 3:"Цепная атака", 5:"Базовый навык", 6:"Поддержка" };
function zWeaponMain(v, lvl, brk){ return Math.floor(v * (1 + 0.1568166666666667 * lvl + 0.8922 * brk)); }
function zWeaponSub(v, brk){ return Math.floor(v * (1 + 0.3 * brk)); }
function zDiscMain(v, lvl, rar){ const k = { 4:.2, 3:.25, 2:.3 }[rar] || .2; return Math.floor(v + v * lvl * k); }
function zProp(pid){
  const B = SCB.nap, p = B.props[String(pid)];
  if(!p) return "#" + pid;
  const key = p.k.replace(/_Ratio$|_base$|_Base$/, "");
  const same = Object.values(B.props).find(x => x.k === key && x.n);
  return (ru() ? (same && same.n) || p.n : (same && same.en) || p.en) || p.k;
}
function zVal(pid, v){
  const p = SCB.nap.props[String(pid)], f = p ? p.f : "";
  if(f.indexOf("%") !== -1) return fPct(v / 100);
  if(/^305|^320/.test(String(pid))) return (v / 100).toLocaleString("ru-RU", { maximumFractionDigits:2 });
  return fInt(v);
}
// иконки ZZZ из игры (icons/zzz): характеристики — маской (цвет текста), бонус урона — цветная иконка базовой стихии
function zIc(pid){
  const p = String(pid).slice(0, 3);
  const m = { "111":"hp", "121":"atk", "131":"def", "122":"impact", "201":"cr", "211":"cd", "314":"am", "312":"ap", "231":"penr", "232":"pen", "305":"er", "320":"rp", "123":"sheer" }[p];
  if(m) return "zzz:" + m;
  const el = { "315":"physical", "316":"fire", "317":"ice", "318":"electric", "319":"ether" }[p];
  return el ? "zimg:el_" + el : "dot";
}
const ZZZ_EL_IC = { Fire:"fire", Ice:"ice", Elec:"electric", Physics:"physical", Ether:"ether", Wind:"wind", Lumen:"lumen", FireFrost:"frost", AuricEther:"auric", ZhenZhenAssault:"honed" };
const ZZZ_PRO_IC = { Attack:"attack", Stun:"stun", Anomaly:"anomaly", Support:"support", Defense:"defense", Rupture:"rupture" };
const ZZZ_SKILL_IC = { 0:"basic", 1:"special", 2:"dodge", 3:"chain", 6:"assist" };
function zzzVM(av){
  const B = SCB.nap, id = String(av.Id), info = B.avatars[id] || {};
  const lvl = av.Level || 1, promo = Math.max(0, (av.PromotionLevel || 1) - 1), core = av.CoreSkillEnhancement || 0;
  const base = {}, add = {};
  Object.keys(info.base || {}).forEach(p => {
    base[p] = info.base[p] + Math.floor(((info.grow || {})[p] || 0) * (lvl - 1) / 10000) +
      (((info.promo || [])[promo] || {})[p] || 0) + (((info.core || [])[core] || {})[p] || 0);
  });
  const put = (pid, v) => { pid = String(pid); add[pid] = (add[pid] || 0) + v; };
  const w = av.Weapon, wi = w && B.weapons[String(w.Id)];
  let weapon = null;
  if(w && wi){
    const main = wi.main ? zWeaponMain(wi.main[1], w.Level || 1, w.BreakLevel || 0) : 0;
    const sub = wi.sub ? zWeaponSub(wi.sub[1], w.BreakLevel || 0) : 0;
    if(wi.main) base[wi.main[0]] = (base[wi.main[0]] || 0) + main;
    if(wi.sub) put(wi.sub[0], sub);
    weapon = { title:"Амплификатор", name: scItemName("nap", w.Id) || "#" + w.Id, img: wi.img, top: wi.r === 4, badge: wi.r === 4 ? "S" : wi.r === 3 ? "A" : "B",
      lvl: w.Level || 1, refine:{ label:"P", n: w.UpgradeLevel || 1 },
      stats: [wi.main && [zProp(wi.main[0]), zVal(wi.main[0], main), zIc(wi.main[0]), String(wi.main[0]).slice(0, 3)], wi.sub && [zProp(wi.sub[0]), zVal(wi.sub[0], sub), zIc(wi.sub[0]), String(wi.sub[0]).slice(0, 3)]].filter(Boolean) };
  }
  const hl = (info.hl || []).map(String);
  // полезные сабстаты — только те, что рекомендованы агенту и вообще бывают в сабстатах дисков
  // (HP%, сила атаки %, защита %, крит. шанс, крит. урон, знание аномалии, пробивание);
  // контроль аномалии, импульс и т.п. в сабстатах не выпадают
  const valuable = {};
  hl.forEach(p => {
    if(p === "20101") valuable["20103"] = 1;
    if(p === "21101") valuable["21103"] = 1;
    if(p === "12101" || p === "12201") valuable["12102"] = 1;
    if(p === "11101") valuable["11102"] = 1;
    if(p === "13101") valuable["13102"] = 1;
    if(p === "31201") valuable["31203"] = 1;
    if(p === "23101" || p === "23201") valuable["23203"] = 1;
    if(p === "12301"){ valuable["12102"] = 1; valuable["11102"] = 1; }   // сила сквозной атаки растёт от силы атаки и HP
  });
  const slots = [], cnt = {};
  let cv = 0;
  scList(av.EquippedList).forEach(slot => {
    const e = slot.Equipment || slot, di = B.discs[String(e.Id)] || [4, ""];
    const rar = di[0], suit = di[1], su = B.suits[suit] || {};
    cnt[suit] = (cnt[suit] || 0) + 1;
    const mains = scList(e.MainPropertyList || e.MainStatList).map(m => [String(m.PropertyId), zDiscMain(m.PropertyValue || 0, e.Level || 0, rar)]);
    const subs = scList(e.RandomPropertyList).map(m => [String(m.PropertyId), (m.PropertyValue || 0) * (m.PropertyLevel || 1), m.PropertyLevel || 1]);
    mains.forEach(m => put(m[0], m[1])); subs.forEach(m => put(m[0], m[1]));
    subs.forEach(s => { if(s[0] === "20103") cv += 2 * s[1]; if(s[0] === "21103") cv += s[1]; });
    slots.push({ pos: slot.Slot || e.Slot || slots.length + 1, label: String(slot.Slot || slots.length + 1), set: scLoc(su), icon: su.icon, lvl: e.Level || 0, top: rar === 4, rank: rar === 4 ? "S" : rar === 3 ? "A" : "B",
      main: mains[0] ? [zProp(mains[0][0]), zVal(mains[0][0], mains[0][1]), zIc(mains[0][0]), mains[0][0].slice(0, 3)] : null,
      subs: subs.map(s => ({ n: zProp(s[0]), v: zVal(s[0], s[1]), up: s[2] - 1, val: !!valuable[s[0]], ic: zIc(s[0]), key: s[0], raw: s[1], fmt: v => zVal(s[0], v) })) });
  });
  const sets = Object.keys(cnt).filter(s => s && cnt[s] >= 2).sort((a, b) => cnt[b] - cnt[a]).map(s => {
    const su = B.suits[s] || {};
    Object.keys(su.bonus || {}).forEach(p => put(p, su.bonus[p]));
    return { name: scLoc(su), icon: su.icon, full: cnt[s] >= 4 };
  });
  const pct = (b, r, f) => Math.floor((base[b] || 0) * (1 + (add[r] || 0) / 10000) + (add[f] || 0));
  const flat = (b, f) => (base[b] || 0) + (add[f] || 0);
  const row = (key, pid, total, b, hlKey) => ({ n: key, v: zVal(pid, total), base: b !== undefined && total > b ? zVal(pid, b) : "", add: b !== undefined && total > b ? zVal(pid, total - b) : "", hl: hl.indexOf(hlKey) !== -1, ic: zIc(pid), f: String(pid).slice(0, 3) });
  const T = { hp: pct("11101", "11102", "11103"), atk: pct("12101", "12102", "12103"), def: pct("13101", "13102", "13103"),
    imp: pct("12201", "12202", "12203"), cr: flat("20101", "20103"), cd: flat("21101", "21103"), am: pct("31401", "31402", "31403"),
    ap: flat("31201", "31203"), penr: flat("23101", "23103"), pen: flat("23201", "23203"),
    er: Math.round((base["30501"] || 0) * (1 + (add["30502"] || 0) / 10000) + (add["30503"] || 0)),
    rp: Math.round((base["32001"] || 0) * (1 + (add["32002"] || 0) / 10000) + (add["32003"] || 0)) };
  // у агентов «Разрушения» вместо энергии адреналин, и есть сила сквозной атаки: 30% силы атаки + 10% HP
  const rupture = info.pro === "Rupture";
  if(rupture) T.sheer = Math.floor(T.atk * 0.3 + T.hp * 0.1) + (base["12301"] || 0) + (add["12303"] || 0);
  const stats = [
    row("HP", "11103", T.hp, base["11101"], "11101"), row(zProp("12101"), "12103", T.atk, base["12101"], "12101"), row(zProp("13101"), "13103", T.def, base["13101"], "13101"),
    row(zProp("12201"), "12203", T.imp, base["12201"], "12201"), row(zProp("20103"), "20103", T.cr, base["20101"], "20101"), row(zProp("21103"), "21103", T.cd, base["21101"], "21101"),
    row(zProp("31203"), "31203", T.ap, base["31201"], "31201"), row(zProp("31401"), "31403", T.am, base["31401"], "31401"), row(zProp("23103"), "23103", T.penr, undefined, "23101"),
    row(zProp("23203"), "23203", T.pen, undefined, "23201"),
    row(zProp("30503"), "30503", T.er, undefined, "30501")
  ];
  if(rupture) stats.pop();   // у «Разрушения» энергии нет, а адреналин, как и Enka, не показываем
  if(rupture) stats.splice(8, 0, row(zProp("12303"), "12303", T.sheer, undefined, "12301"));   // как у Enka: после контроля аномалии
  ["31501","31601","31701","31801","31901"].forEach(b => { const v = flat(b, String(Number(b) + 2)); if(v) stats.push(row(zProp(b), b, v, undefined, b)); });
  let keys = [[zProp("12101"), zVal("12103", T.atk)], [ru() ? "Шанс крита" : "CRIT Rate", zVal("20103", T.cr)], [zProp("21103"), zVal("21103", T.cd)]];
  if(hl.indexOf("31401") !== -1 || hl.indexOf("31201") !== -1) keys[0] = [zProp("31203"), zVal("31203", T.ap)];
  if(hl.indexOf("12201") !== -1) keys[0] = [zProp("12201"), zVal("12203", T.imp)];
  const m = av.TalentLevel || 0, boost = m >= 5 ? 4 : m >= 3 ? 2 : 0;
  const skills = scList(av.SkillLevelList).filter(s => ZZZ_SKILL[s.Index] !== undefined).sort((a, b) => a.Index - b.Index)
    .map(s => [ZZZ_SKILL[s.Index], (s.Level || 0) + boost, s.Index]);
  skills.push(["Ядро", core ? "ABCDEF".charAt(core - 1) : "—"]);
  const el = zzzElement(info.el);
  return { name: scItemName("nap", id) || "#" + id, art: info.img, circle: info.circle || info.img, el: el.n, color: el.c, cls: ZZZ_PRO[info.pro] || info.pro, elIc: ZZZ_EL_IC[el.k] || "", proIc: ZZZ_PRO_IC[info.pro] || "", rank: ((itemsDb.nap && itemsDb.nap.items[id]) || {}).r === 3 ? "A" : "S", valuable,
    lvl, maxLvl: 60, cons:{ label:"M", title:"Кинограмма", n:m }, keys, skills, stats, weapon, sets, cv, slotsTitle:"Диски", setsWord:"дисков",
    slots: [1,2,3,4,5,6].map(i => slots.find(s => s.pos === i) || { pos:i, label:String(i), empty:true }),
    foot: "Характеристики посчитаны по формулам Enka: агент, амплификатор, диски и бонусы комплектов за 2 предмета. Пассивки амплификатора, эффекты за 4 предмета и баффы в бою не учитываются, поэтому цифры могут немного отличаться от окна агента в игре." };
}

/* ════════════ Honkai: Star Rail ════════════ */
const HSR_EL = { Physical:["Физический","#d6d6d6"], Fire:["Огненный","#f0603c"], Ice:["Ледяной","#73d4ff"], Thunder:["Электрический","#c77dff"],
  Wind:["Ветряной","#5fe0a8"], Quantum:["Квантовый","#8f80ff"], Imaginary:["Мнимый","#f5d04f"] };
const HSR_PATH = { Warrior:"Разрушение", Rogue:"Охота", Mage:"Эрудиция", Shaman:"Гармония", Warlock:"Небытие", Knight:"Сохранение",
  Priest:"Изобилие", Memory:"Память", Elation:"Радость" };
const HSR_SLOT = { 1:"Голова", 2:"Руки", 3:"Тело", 4:"Ноги", 5:"Сфера", 6:"Канат", HEAD:1, HAND:2, BODY:3, FOOT:4, NECK:5, OBJECT:6 };
const HSR_SKILL = { 1:"Обычная атака", 2:"Навык", 3:"Абсолютная техника", 4:"Талант" };
// какое свойство реликвии/следа к какой характеристике относится и в процентах ли оно
function hProp(p){
  const map = { HPDelta:["MaxHP",0], HPAddedRatio:["MaxHP",1], AttackDelta:["Attack",0], AttackAddedRatio:["Attack",1], DefenceDelta:["Defence",0],
    DefenceAddedRatio:["Defence",1], SpeedDelta:["Speed",0], BaseSpeed:["Speed",0], SpeedAddedRatio:["Speed",1], CriticalChanceBase:["CriticalChance",1],
    CriticalDamageBase:["CriticalDamage",1], BreakDamageAddedRatioBase:["BreakDamageAddedRatio",1], HealRatioBase:["HealRatio",1], SPRatioBase:["SPRatio",1],
    StatusProbabilityBase:["StatusProbability",1], StatusResistanceBase:["StatusResistance",1], ElationDamageAddedRatioBase:["ElationDamageAddedRatio",1] };
  if(map[p]) return { k: map[p][0], pct: !!map[p][1] };
  return { k: p, pct: /Ratio|Chance|Damage|Probability|Resistance/.test(p) };
}
function hLabel(k){ return scLoc(SCB.hkrpg.props[k]) || k; }
function hVal(pct, v, spd){ return pct ? fPct(v * 100) : spd && v % 1 ? (Math.round(v * 10) / 10).toLocaleString("ru-RU") : fInt(v); }
// иконки характеристик HSR — картинки из HoYoLAB (icons/hsr), где картинки нет — своя SVG
const H_IMG = { MaxHP:"hp", Attack:"atk", Defence:"def", Speed:"spd", CriticalChance:"cr", CriticalDamage:"cd", BreakDamageAddedRatio:"be", HealRatio:"heal",
  SPRatio:"er", StatusProbability:"ehr", StatusResistance:"res", ElationDamageAddedRatio:"elation",
  PhysicalAddedRatio:"physical", FireAddedRatio:"fire", IceAddedRatio:"ice", ThunderAddedRatio:"thunder", WindAddedRatio:"wind",
  QuantumAddedRatio:"quantum", ImaginaryAddedRatio:"imaginary" };
function hIc(k){
  if(H_IMG[k]) return "hsr:" + H_IMG[k];
  return { MaxHP:"hp", Attack:"atk", Defence:"def", Speed:"spd", CriticalChance:"cr", CriticalDamage:"cd", BreakDamageAddedRatio:"be", HealRatio:"heal",
    SPRatio:"er", StatusProbability:"ehr", StatusResistance:"res", ElationDamageAddedRatio:"be" }[k] || (/AddedRatio$/.test(k) ? "dmg" : "dot");
}
function hsrVM(av){
  const B = SCB.hkrpg, id = String(av.avatarId), A = B.avatars[id] || {};
  const lvl = av.level || 1, P = (A.promo || {})[String(av.promotion || 0)] || {};
  const base = { hp: (P.HPBase || 0) + (P.HPAdd || 0) * (lvl - 1), atk: (P.AttackBase || 0) + (P.AttackAdd || 0) * (lvl - 1),
    def: (P.DefenceBase || 0) + (P.DefenceAdd || 0) * (lvl - 1), spd: P.SpeedBase || 0 };
  const add = {};
  const put = (p, v) => { add[p] = (add[p] || 0) + v; };
  const putAll = props => Object.keys(props || {}).forEach(p => put(p, props[p]));
  // следы
  scList(av.skillTreeList).forEach(t => { const x = (B.tree[String(t.pointId)] || {})[String(t.level)]; if(x) putAll(x.props); });
  // световой конус
  let weapon = null;
  const e = av.equipment;
  if(e && B.lcs[String(e.tid)]){
    const L = B.lcs[String(e.tid)], lp = L.promo[String(e.promotion || 0)] || {}, el = e.level || 1;
    const hp = (lp.BaseHP || 0) + (lp.HPAdd || 0) * (el - 1), atk = (lp.BaseAttack || 0) + (lp.AttackAdd || 0) * (el - 1), def = (lp.BaseDefence || 0) + (lp.DefenceAdd || 0) * (el - 1);
    base.hp += hp; base.atk += atk; base.def += def;
    if(!L.path || L.path === A.path) putAll(((L.skill || {})[String(e.rank || 1)] || {}).props);   // пассивка — только на своём пути
    weapon = { title:"Световой конус", name: scItemName("hkrpg", e.tid) || "#" + e.tid, img: L.img, top: L.r === 5, badge: L.r + "★", tall: true,
      lvl: el, refine:{ label:"S", n: e.rank || 1 }, stats: [[hLabel("MaxHP"), fInt(hp)], [hLabel("Attack"), fInt(atk)], [hLabel("Defence"), fInt(def)]] };
  }
  // реликвии
  const slots = [], cnt = {};
  let cv = 0;
  const pathVal = { Warrior:["CriticalChance","CriticalDamage","Attack%"], Rogue:["CriticalChance","CriticalDamage","Attack%"], Mage:["CriticalChance","CriticalDamage","Attack%"],
    Memory:["CriticalChance","CriticalDamage","MaxHP%"], Elation:["CriticalChance","CriticalDamage","Attack%"], Warlock:["StatusProbability","Attack%","BreakDamageAddedRatio"],
    Shaman:["BreakDamageAddedRatio","StatusResistance"], Priest:["MaxHP%","StatusResistance"], Knight:["Defence%","StatusResistance","StatusProbability"] }[A.path] || ["CriticalChance","CriticalDamage"];
  const isVal = (k, pct) => k === "Speed" || pathVal.indexOf(k + (pct && /MaxHP|Attack|Defence/.test(k) ? "%" : "")) !== -1;
  scList(av.relicList).forEach(r => {
    const it = B.relics[String(r.tid)]; if(!it) return;
    const [rar, type, mg, sg, setId, icon] = it;
    cnt[setId] = (cnt[setId] || 0) + 1;
    const ma = ((B.main[String(mg)] || {})[String(r.mainAffixId)]) || null;
    let main = null;
    if(ma){ const v = ma.BaseValue + ma.LevelAdd * (r.level || 0), pp = hProp(ma.Property); put(ma.Property, v); main = [hLabel(pp.k), hVal(pp.pct, v, pp.k === "Speed"), hIc(pp.k)]; }
    const subs = scList(r.subAffixList).map(s => {
      const x = (B.sub[String(sg)] || {})[String(s.affixId)]; if(!x) return null;
      const n = s.cnt || 1, v = x.BaseValue * n + x.StepValue * (s.step || 0), pp = hProp(x.Property);
      put(x.Property, v);
      if(pp.k === "CriticalChance") cv += 2 * v * 100; if(pp.k === "CriticalDamage") cv += v * 100;
      return { n: hLabel(pp.k), v: hVal(pp.pct, v, pp.k === "Speed"), up: n - 1, val: isVal(pp.k, pp.pct), ic: hIc(pp.k), key: pp.k + (pp.pct ? "%" : ""), raw: v, fmt: x => hVal(pp.pct, x, pp.k === "Speed") };
    }).filter(Boolean);
    const pos = typeof r.type === "number" ? r.type : (HSR_SLOT[type] || slots.length + 1);
    const st = B.sets[String(setId)] || {};
    slots.push({ pos, label: HSR_SLOT[pos] || String(pos), set: scLoc(st), icon, lvl: r.level || 0, top: rar === 5, main, subs });
  });
  const sets = Object.keys(cnt).filter(s => cnt[s] >= 2).sort((a, b) => cnt[b] - cnt[a]).map(s => {
    const st = B.sets[s] || {};
    putAll(((st.bonus || {})["2"] || {}).props);
    if(cnt[s] >= 4) putAll(((st.bonus || {})["4"] || {}).props);
    return { name: scLoc(st), icon: st.icon, full: cnt[s] >= 4 && Number(s) < 300 };
  });
  const g = k => add[k] || 0;
  const T = {
    hp: base.hp * (1 + g("HPAddedRatio")) + g("HPDelta"), atk: base.atk * (1 + g("AttackAddedRatio")) + g("AttackDelta"),
    def: base.def * (1 + g("DefenceAddedRatio")) + g("DefenceDelta"), spd: base.spd * (1 + g("SpeedAddedRatio")) + g("SpeedDelta") + g("BaseSpeed"),
    cr: (P.CriticalChance || 0) + g("CriticalChanceBase"), cd: (P.CriticalDamage || 0) + g("CriticalDamageBase"),
    be: g("BreakDamageAddedRatioBase"), ohb: g("HealRatioBase"), err: 1 + g("SPRatioBase"), ehr: g("StatusProbabilityBase"), res: g("StatusResistanceBase")
  };
  const elKey = A.el === "Thunder" ? "Thunder" : A.el;
  const dmg = g(elKey + "AddedRatio") + g("AllDamageTypeAddedRatio");
  const hl = { Warrior:["Attack","CriticalChance","CriticalDamage"], Rogue:["Attack","CriticalChance","CriticalDamage"], Mage:["Attack","CriticalChance","CriticalDamage"],
    Memory:["MaxHP","CriticalChance","CriticalDamage"], Elation:["Attack","CriticalChance","CriticalDamage"], Warlock:["Attack","StatusProbability"],
    Shaman:["Speed","BreakDamageAddedRatio"], Priest:["MaxHP","HealRatio"], Knight:["Defence"] }[A.path] || [];
  const row = (k, v, pct, b) => ({ n: hLabel(k), v: hVal(pct, v), base: b && v > b + .5 ? fInt(b) : "", add: b && v > b + .5 ? fInt(v - b) : "", hl: hl.indexOf(k) !== -1 || k === "Speed", ic: hIc(k) });
  // все характеристики в игровом порядке, включая нулевые
  const stats = [row("MaxHP", T.hp, 0, base.hp), row("Attack", T.atk, 0, base.atk), row("Defence", T.def, 0, base.def), row("Speed", T.spd, 0, base.spd),
    row("CriticalChance", T.cr, 1), row("CriticalDamage", T.cd, 1), row(elKey + "AddedRatio", dmg, 1), row("BreakDamageAddedRatio", T.be, 1),
    row("ElationDamageAddedRatio", g("ElationDamageAddedRatioBase") + g("ElationDamageAddedRatio"), 1), row("HealRatio", T.ohb, 1),
    row("SPRatio", T.err, 1), row("StatusProbability", T.ehr, 1), row("StatusResistance", T.res, 1)];
  let keys = [[hLabel("Speed"), hVal(0, T.spd)], [hLabel("CriticalChance"), hVal(1, T.cr)], [hLabel("CriticalDamage"), hVal(1, T.cd)]];
  if(A.path === "Priest") keys = [[hLabel("Speed"), hVal(0, T.spd)], [hLabel("MaxHP"), fInt(T.hp)], [hLabel("HealRatio"), hVal(1, T.ohb)]];
  if(A.path === "Knight") keys = [[hLabel("Speed"), hVal(0, T.spd)], [hLabel("Defence"), fInt(T.def)], [hLabel("MaxHP"), fInt(T.hp)]];
  if(A.path === "Shaman") keys = [[hLabel("Speed"), hVal(0, T.spd)], [hLabel("BreakDamageAddedRatio"), hVal(1, T.be)], [hLabel("SPRatio"), hVal(1, T.err)]];
  // уровни навыков с бонусом от эйдолонов
  const rank = av.rank || 0, boost = {};
  (A.ranks || []).slice(0, rank).forEach(m => Object.keys(m || {}).forEach(s => { boost[s] = (boost[s] || 0) + m[s]; }));
  const skills = scList(av.skillTreeList).filter(t => { const n = t.pointId % 1000; return n >= 1 && n <= 4 && Math.floor(t.pointId / 1000) === Number(id); })
    .sort((a, b) => a.pointId - b.pointId).map(t => { const n = t.pointId % 1000; return [HSR_SKILL[n], (t.level || 0) + (boost[String(Number(id) * 100 + n)] || 0)]; });
  // следы: навыки с иконками (включая навыки спутника), бонусные способности и узлы характеристик
  const lvOf = {}; scList(av.skillTreeList).forEach(t => { lvOf[String(t.pointId)] = t.level || 0; });
  const pts = A.points || {};
  const skName = pid => { const n = Number(pid) % 1000; return HSR_SKILL[n] || (n >= 300 && n < 400 ? (n % 2 ? "Навык спутника" : "Талант спутника") : n >= 400 ? "Особый навык" : "Навык"); };
  const tSkills = Object.keys(pts).filter(p => (pts[p][1] === 2 || pts[p][1] === 4) && Number(p) % 1000 !== 7 && lvOf[p])
    .sort((a, b) => Number(a) - Number(b))
    .map(p => ({ n: skName(p), lv: lvOf[p] + (boost[String(Number(id) * 100 + Number(p) % 1000)] || 0), icon: pts[p][0] }));
  const majors = Object.keys(pts).filter(p => pts[p][1] === 3).sort().map(p => ({ icon: pts[p][0], on: !!lvOf[p] }));
  const minors = Object.keys(pts).filter(p => pts[p][1] === 1).sort().map(p => ({ icon: pts[p][0], on: !!lvOf[p] }));
  const treeSum = {};
  Object.keys(pts).filter(p => pts[p][1] === 1 && lvOf[p]).forEach(p => {
    const x = (B.tree[p] || {})[String(lvOf[p])]; if(!x) return;
    Object.keys(x.props || {}).forEach(k => { treeSum[k] = (treeSum[k] || 0) + x.props[k]; });
  });
  const treeBonus = Object.keys(treeSum).map(k => { const pp = hProp(k); return { n: hLabel(pp.k), v: "+" + hVal(pp.pct, treeSum[k], pp.k === "Speed") }; });
  // полезные усиления реликвий: сколько раз выпадала каждая полезная доп. характеристика
  const useful = {};
  slots.forEach(d => d.subs.forEach(su => { if(su.val){ useful[su.n] = (useful[su.n] || 0) + su.up + 1; } }));
  const el = HSR_EL[A.el] || [A.el, "#f0c264"];
  return { traces:{ skills: tSkills, majors, minors, bonus: treeBonus }, rankIcons: A.rankIcons || [], useful,
    name: scItemName("hkrpg", id) || "#" + id, art: A.img, circle: A.circle, el: el[0], color: el[1], cls: HSR_PATH[A.path] || A.path,
    lvl, maxLvl: 80, cons:{ label:"E", title:"Эйдолон", n: rank }, keys, skills, stats, weapon, sets, cv: cv * 100, slotsTitle:"Реликвии", setsWord:"реликвий",
    slots: [1,2,3,4,5,6].map(i => slots.find(s => s.pos === i) || { pos:i, label: HSR_SLOT[i], empty:true }),
    foot: "Характеристики посчитаны по данным игры: персонаж, конус, следы, реликвии и постоянные бонусы комплектов. Пассивка конуса учитывается, только если её бонус постоянный и путь совпадает; баффы в бою не учитываются." };
}

/* ════════════ Genshin Impact ════════════ */
const GI_EL = { Fire:["Пиро","#ff7a45"], Water:["Гидро","#4fb3ff"], Wind:["Анемо","#59e0c0"], Electric:["Электро","#c07bff"],
  Grass:["Дендро","#8fd14f"], Ice:["Крио","#9fe6ff"], Rock:["Гео","#f2c14e"] };
const GI_WT = { WEAPON_SWORD_ONE_HAND:"Одноручный меч", WEAPON_CLAYMORE:"Двуручный меч", WEAPON_POLE:"Древковое", WEAPON_CATALYST:"Катализатор", WEAPON_BOW:"Лук" };
const GI_SLOT = { EQUIP_BRACER:[1,"Цветок"], EQUIP_NECKLACE:[2,"Перо"], EQUIP_SHOES:[3,"Пески"], EQUIP_RING:[4,"Кубок"], EQUIP_DRESS:[5,"Корона"] };
const GI_FP = { 1:"FIGHT_PROP_BASE_HP", 2:"FIGHT_PROP_HP", 3:"FIGHT_PROP_HP_PERCENT", 4:"FIGHT_PROP_BASE_ATTACK", 5:"FIGHT_PROP_ATTACK", 6:"FIGHT_PROP_ATTACK_PERCENT",
  7:"FIGHT_PROP_BASE_DEFENSE", 8:"FIGHT_PROP_DEFENSE", 9:"FIGHT_PROP_DEFENSE_PERCENT", 20:"FIGHT_PROP_CRITICAL", 22:"FIGHT_PROP_CRITICAL_HURT",
  23:"FIGHT_PROP_CHARGE_EFFICIENCY", 26:"FIGHT_PROP_HEAL_ADD", 28:"FIGHT_PROP_ELEMENT_MASTERY", 30:"FIGHT_PROP_PHYSICAL_ADD_HURT",
  40:"FIGHT_PROP_FIRE_ADD_HURT", 41:"FIGHT_PROP_ELEC_ADD_HURT", 42:"FIGHT_PROP_WATER_ADD_HURT", 43:"FIGHT_PROP_GRASS_ADD_HURT",
  44:"FIGHT_PROP_WIND_ADD_HURT", 45:"FIGHT_PROP_ROCK_ADD_HURT", 46:"FIGHT_PROP_ICE_ADD_HURT" };
const GI_ELDMG = { Fire:40, Electric:41, Water:42, Grass:43, Wind:44, Rock:45, Ice:46 };
function gLabel(fp){ return scLoc(SCB.hk4e.props[fp]) || fp.replace("FIGHT_PROP_", ""); }
function gPct(fp){ return /PERCENT|CRITICAL|CHARGE|HURT|HEAL_ADD/.test(fp); }
function gVal(fp, v){ return gPct(fp) ? fPct(v) : fInt(v); }
function gIc(fp){
  const k = String(fp).replace("FIGHT_PROP_", "").replace(/^BASE_/, "");
  return { HP:"hp", HP_PERCENT:"hp", ATTACK:"atk", ATTACK_PERCENT:"atk", DEFENSE:"def", DEFENSE_PERCENT:"def", ELEMENT_MASTERY:"em",
    CRITICAL:"cr", CRITICAL_HURT:"cd", CHARGE_EFFICIENCY:"er", HEAL_ADD:"heal" }[k] || (/ADD_HURT$/.test(k) ? "dmg" : "dot");
}
function giVM(av){
  const B = SCB.hk4e, id = String(av.avatarId), A = B.avatars[id] || {};
  const pm = av.propMap || {}, f = av.fightPropMap || {};
  const lvl = Number((pm["4001"] || {}).val || (pm["4001"] || {}).ival || 1);
  const F = k => Number(f[k] || 0);
  const valuable = { FIGHT_PROP_CRITICAL:1, FIGHT_PROP_CRITICAL_HURT:1, FIGHT_PROP_ATTACK_PERCENT:1, FIGHT_PROP_CHARGE_EFFICIENCY:1, FIGHT_PROP_ELEMENT_MASTERY: F(28) >= 250 ? 1 : 0 };
  let weapon = null;
  const slots = [], cnt = {};
  let cv = 0;
  (av.equipList || []).forEach(eq => {
    const fl = eq.flat || {};
    if(eq.weapon){
      const ref = (Object.values(eq.weapon.affixMap || {})[0] || 0) + 1;
      weapon = { title:"Оружие", name: scItemName("hk4e", eq.itemId) || "#" + eq.itemId, img: fl.icon ? "/ui/" + fl.icon + ".png" : "", top: fl.rankLevel === 5,
        badge: (fl.rankLevel || "") + "★", lvl: eq.weapon.level || 1, refine:{ label:"R", n: ref },
        stats: (fl.weaponStats || []).map(s => [gLabel(s.appendPropId), gVal(s.appendPropId, s.statValue)]) };
      return;
    }
    if(!eq.reliquary) return;
    const sl = GI_SLOT[fl.equipType] || [slots.length + 1, "—"];
    const hash = String(fl.setNameTextMapHash || "");
    cnt[hash] = cnt[hash] || { n:0, icon: fl.icon };
    cnt[hash].n++;
    const ids = (eq.reliquary.appendPropIdList || []).map(x => GI_FP[B.affix[String(x)]]);
    const ms = fl.reliquaryMainstat || {};
    slots.push({ pos: sl[0], label: sl[1], set: scLoc(B.sets[hash]), icon: fl.icon ? "/ui/" + fl.icon + ".png" : "", lvl: Math.max(0, (eq.reliquary.level || 1) - 1), top: fl.rankLevel === 5,
      main: ms.mainPropId ? [gLabel(ms.mainPropId), gVal(ms.mainPropId, ms.statValue), gIc(ms.mainPropId)] : null,
      subs: (fl.reliquarySubstats || []).map(s => {
        if(s.appendPropId === "FIGHT_PROP_CRITICAL") cv += 2 * s.statValue;
        if(s.appendPropId === "FIGHT_PROP_CRITICAL_HURT") cv += s.statValue;
        const rolls = ids.filter(x => x === s.appendPropId).length || 1;
        return { n: gLabel(s.appendPropId), v: gVal(s.appendPropId, s.statValue), up: rolls - 1, val: !!valuable[s.appendPropId], ic: gIc(s.appendPropId), key: s.appendPropId, raw: s.statValue, fmt: x => gVal(s.appendPropId, x) };
      }) });
  });
  const sets = Object.keys(cnt).filter(h => cnt[h].n >= 2).sort((a, b) => cnt[b].n - cnt[a].n)
    .map(h => ({ name: scLoc(B.sets[h]) || "Комплект", icon: cnt[h].icon ? "/ui/" + cnt[h].icon + ".png" : "", full: cnt[h].n >= 4 }));
  const elDmg = GI_ELDMG[A.el];
  const row = (fp, total, base) => ({ n: gLabel(fp), v: gVal(fp, gPct(fp) ? total * 100 : total), base: base && total > base ? fInt(base) : "", add: base && total > base ? fInt(total - base) : "", hl: false, ic: gIc(fp) });
  const stats = [row("FIGHT_PROP_HP", F(2000), F(1)), row("FIGHT_PROP_ATTACK", F(2001), F(4)), row("FIGHT_PROP_DEFENSE", F(2002), F(7)),
    row("FIGHT_PROP_ELEMENT_MASTERY", F(28)), row("FIGHT_PROP_CRITICAL", F(20)), row("FIGHT_PROP_CRITICAL_HURT", F(22)), row("FIGHT_PROP_CHARGE_EFFICIENCY", F(23))];
  if(F(26)) stats.push(row("FIGHT_PROP_HEAL_ADD", F(26)));
  if(elDmg && F(elDmg)) stats.push(row(GI_FP[elDmg], F(elDmg)));
  if(F(30) > F(elDmg || 0)) stats.push(row("FIGHT_PROP_PHYSICAL_ADD_HURT", F(30)));
  stats[1].hl = stats[4].hl = stats[5].hl = true;
  let keys = [[gLabel("FIGHT_PROP_ATTACK"), fInt(F(2001))], [ru() ? "Шанс крита" : "CRIT Rate", fPct(F(20) * 100)], [gLabel("FIGHT_PROP_CRITICAL_HURT"), fPct(F(22) * 100)]];
  if(F(28) >= 300) keys[0] = [gLabel("FIGHT_PROP_ELEMENT_MASTERY"), fInt(F(28))];
  const extra = av.proudSkillExtraLevelMap || {}, sl = av.skillLevelMap || {};
  const sn = ["Обычная атака", "Элементальный навык", "Взрыв стихии"];
  const skills = (A.skills || []).map((s, i) => [sn[i] || "Навык", (sl[String(s)] || 1) + (extra[String((A.proud || {})[String(s)])] || 0)]);
  const el = GI_EL[A.el] || [A.el, "#f0c264"];
  const cons = (av.talentIdList || []).length;
  const it = itemsDb.hk4e && itemsDb.hk4e.items[id];
  return { name: scItemName("hk4e", id) || "#" + id, art: A.img, circle: A.circle, el: el[0], color: el[1], cls: GI_WT[A.wt] || "",
    lvl, maxLvl: Math.max(90, lvl), cons:{ label:"C", title:"Созвездие", n: cons }, rarity: it ? it.r : 5, friend: (av.fetterInfo || {}).expLevel || 0, keys, skills, stats, weapon, sets, cv: cv * 100, slotsTitle:"Артефакты", setsWord:"артефактов",
    slots: [1,2,3,4,5].map(i => slots.find(s => s.pos === i) || { pos:i, label: ["Цветок","Перо","Пески","Кубок","Корона"][i - 1], empty:true }),
    foot: "Характеристики — как в окне персонажа в игре: их присылает сама игра через витрину профиля." };
}

/* ════════════ общее ════════════ */
const SCG = {
  nap:   { title:"Zenless Zone Zero", api:"zzz/uid", who:"агентов", one:"агента", vm: zzzVM,
           parse(j){ const pi = j.PlayerInfo || {}, prof = ((pi.SocialDetail || {}).ProfileDetail) || {};
             return { uid: j.uid || prof.Uid, nick: prof.Nickname, level: prof.Level, list: (((pi.ShowcaseDetail || {}).AvatarList) || []).map(a => [String(a.Id), a]) }; } },
  hkrpg: { title:"Honkai: Star Rail", api:"hsr/uid", who:"персонажей", one:"персонажа", vm: hsrVM,
           parse(j){ const d = j.detailInfo || {}; const list = (d.avatarDetailList || []).concat(d.assistAvatarList || []);
             const seen = {}; return { uid: j.uid || d.uid, nick: d.nickname, level: d.level,
               list: list.filter(a => a && a.avatarId && !seen[a.avatarId] && (seen[a.avatarId] = 1)).map(a => [String(a.avatarId), a]) }; } },
  hk4e:  { title:"Genshin Impact", api:"uid", who:"персонажей", one:"персонажа", vm: giVM,
           parse(j){ const p = j.playerInfo || {};
             return { uid: j.uid, nick: p.nickname, level: p.level, list: (j.avatarInfoList || []).map(a => [String(a.avatarId), a]) }; } }
};
function scGame(){ const g = histGameKey(); return SCG[g] ? g : "nap"; }
function scUid(){ const inp = document.getElementById("scUid"); return (inp && inp.value || "").replace(/\D/g, ""); }
function scUrl(game, uid){ return (ui.enkaProxy || "https://enka.network").replace(/\/+$/, "") + "/api/" + SCG[game].api + "/" + uid; }
function scIngest(game, j, uidHint){
  const p = SCG[game].parse(j);
  if(!p.list.length && !p.uid) throw new Error("Это не похоже на ответ Enka для " + SCG[game].title + ".");
  const uid = String(p.uid || uidHint || "");
  if(!uid) throw new Error("В файле нет UID.");
  const now = new Date().toISOString();
  const u = enkaData[game + ":" + uid] = enkaData[game + ":" + uid] || { agents:{} };
  u.nick = p.nick || u.nick || ""; u.level = p.level || u.level || 0; u.at = now;
  u.shown = p.list.map(x => x[0]);
  p.list.forEach(x => { u.agents[x[0]] = { at: now, a: x[1] }; });
  ui.scUidG = ui.scUidG || {}; ui.scUidG[game] = uid;
  document.getElementById("scUid").value = uid;
  ui.scAgentG = ui.scAgentG || {};
  if(p.list.length && !u.agents[ui.scAgentG[game]]) ui.scAgentG[game] = p.list[0][0];
  saveUI(); enkaSave();
  return { uid, n: p.list.length };
}
async function scFetch(){
  const game = scGame(), uid = scUid();
  const note = document.getElementById("scNote"), help = document.getElementById("scHelp");
  if(uid.length < 8){ note.textContent = "Введите UID — 8–10 цифр."; return; }
  const btn = document.getElementById("scLoad");
  btn.disabled = true; btn.textContent = "Загружаю…";
  help.classList.add("hidden");
  try {
    const r = await fetch(scUrl(game, uid), { cache:"no-store" });
    if(r.status === 404){ note.textContent = "Игрок с таким UID не найден."; return; }
    if(r.status === 424){ note.textContent = "Enka сейчас недоступна: в игре техработы или вышло обновление. Попробуйте позже."; return; }
    if(r.status === 429){ note.textContent = "Слишком часто — Enka просит подождать пару минут."; return; }
    if(!r.ok){ note.textContent = "Enka ответила ошибкой " + r.status + "."; return; }
    const res = scIngest(game, await r.json(), uid);
    note.textContent = res.n ? "Загружено " + SCG[game].who + " из витрины: " + res.n + "." : "Витрина профиля пуста — выставьте персонажей в профиле игры.";
    renderShowcase();
  } catch(e){
    note.textContent = "Браузер не смог получить данные напрямую.";
    document.getElementById("scHelpLink").href = "https://enka.network/api/" + SCG[game].api + "/" + uid;
    help.classList.remove("hidden");
  } finally { btn.disabled = false; btn.textContent = "Обновить из витрины"; }
}
function scFile(f){
  const game = scGame(), rd = new FileReader();
  rd.onload = () => {
    const note = document.getElementById("scNote");
    try {
      const res = scIngest(game, JSON.parse(rd.result), scUid());
      note.textContent = "Из файла загружено " + SCG[game].who + ": " + res.n + ".";
      document.getElementById("scHelp").classList.add("hidden");
      renderShowcase();
    } catch(e){ note.textContent = e.message || "Не удалось прочитать файл."; }
  };
  rd.readAsText(f);
}

function scImg(path){ return path ? ENKA_HOST + path : ""; }
let scLastGame = null;
function renderShowcase(){
  const game = scGame(), G = SCG[game];
  document.getElementById("hTitle").childNodes[0].nodeValue = "Витрина";
  const inp = document.getElementById("scUid");
  inp.placeholder = "UID в " + (game === "nap" ? "ZZZ" : game === "hkrpg" ? "Star Rail" : "Genshin");
  if(scLastGame !== game){
    const acc = hdata.accounts.find(a => a.game === game && a.key === hdata.active) || hdata.accounts.find(a => a.game === game);
    inp.value = ((ui.scUidG || {})[game]) || (game === "nap" && ui.scUid) || (acc && acc.uid) || "";
    document.getElementById("scHelp").classList.add("hidden");
    document.getElementById("scNote").textContent = "Сборки берутся из витрины профиля через Enka.Network — в игре выставьте " + G.who + " в витрину. Каждая загрузка сохраняется, так что со временем здесь копятся все, кого вы показывали.";
    scLastGame = game;
  }
  const uid = scUid();
  const u = enkaData[game + ":" + uid];
  document.getElementById("hSub").textContent = G.title + (u && u.nick ? " · " + u.nick + (u.level ? ", ур. " + u.level : "") : "");
  if(!SCB[game] || !itemsDb[game]){ ensureBuild(game, () => ensureItems(game, () => { if(scGame() === game) renderShowcase(); })); ensureItems(game); return; }

  const tabs = document.getElementById("scTabs"), card = document.getElementById("scCard");
  tabs.innerHTML = ""; card.innerHTML = "";
  document.getElementById("scPng").hidden = true; document.getElementById("scCopy").hidden = true;
  if(!u || !Object.keys(u.agents).length){
    card.innerHTML = '<div class="sc-empty">Здесь появятся сборки ' + G.who + ' из витрины вашего профиля: ' +
      (game === "nap" ? "амплификатор, диски" : game === "hkrpg" ? "световой конус, реликвии" : "оружие, артефакты") +
      ' и итоговые характеристики. Введите UID и нажмите «Обновить из витрины». В игре они должны быть выставлены в витрину профиля.</div>';
    return;
  }
  const ids = Object.keys(u.agents).sort((a, b) => {
    const sa = (u.shown || []).indexOf(a), sb = (u.shown || []).indexOf(b);
    if((sa === -1) !== (sb === -1)) return sa === -1 ? 1 : -1;
    if(sa !== sb) return sa - sb;
    return (u.agents[b].at || "").localeCompare(u.agents[a].at || "");
  });
  ui.scAgentG = ui.scAgentG || {};
  if(game === "nap" && !ui.scAgentG.nap && ui.scAgent) ui.scAgentG.nap = ui.scAgent;
  if(!u.agents[ui.scAgentG[game]]) ui.scAgentG[game] = ids[0];
  const vms = {};
  ids.forEach(id => {
    let vm = null;
    try { vm = vms[id] = G.vm(u.agents[id].a); } catch(e){ console.error(e); }
    const b = document.createElement("button");
    const inShow = (u.shown || []).indexOf(id) !== -1;
    b.className = "sc-tab" + (id === ui.scAgentG[game] ? " on" : "") + (inShow ? "" : " old");
    if(vm) b.style.setProperty("--accent", vm.color);
    const nm = vm ? vm.name : "#" + id;
    b.title = nm + (inShow ? "" : " — сейчас не в витрине, сборка от " + u.agents[id].at.slice(0, 10).split("-").reverse().join("."));
    b.innerHTML = '<span>' + esc(nm.charAt(0)) + '</span>' + (vm && vm.circle ? '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(scImg(vm.circle)) + '" onerror="this.remove()">' : "");
    b.onclick = () => { ui.scAgentG[game] = id; saveUI(); renderShowcase(); };
    tabs.appendChild(b);
  });
  const cur = ui.scAgentG[game], vm = vms[cur];
  if(!vm){ card.innerHTML = '<div class="sc-empty">Не удалось разобрать сборку этого персонажа — возможно, он новее справочника. Справочник обновляется раз в неделю.</div>'; return; }
  scLayoutSeg(game);
  document.getElementById("scPng").hidden = false; document.getElementById("scCopy").hidden = !(navigator.clipboard && window.ClipboardItem);
  if(scAltWanted(game)) scRenderAlt(card, game, vm, uid);
  else scRenderCard(card, u, cur, vm);
  artCur = { game, id: String(cur) };
  requestAnimationFrame(() => { scFitText(); artFit(); });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(scFitText);
}

function scPips(n, max){
  let h = '<span class="sc-pips p">';
  for(let i = 1; i <= max; i++) h += '<i class="' + (i <= n ? "on" : "") + '"></i>';
  return h + "</span>";
}
function scRenderCard(card, u, id, vm){
  const rec = u.agents[id];
  const inShow = (u.shown || []).indexOf(id) !== -1;
  let h = '<div class="sc-hero" style="--accent:' + esc(vm.color) + '">' +
    '<div class="sc-art">' +
      '<span class="sc-art-letter"' + (vm.art ? ' hidden' : "") + '>' + esc(vm.name.charAt(0)) + '</span>' +
      (vm.art ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(vm.art)) + '" onerror="this.previousElementSibling.hidden=false;this.remove()">' : "") +
    '</div>' +
    '<div class="sc-head">' +
      '<div class="sc-chips"><span class="sc-el"><i></i>' + esc(vm.el) + '</span>' + (vm.cls ? '<span>' + esc(vm.cls) + '</span>' : "") + '</div>' +
      '<h2>' + esc(vm.name) + '</h2>' +
      '<div class="sc-lvl"><span class="num">Ур. ' + vm.lvl + '</span><div class="sc-lvlbar"><i style="width:' + Math.min(100, vm.lvl / vm.maxLvl * 100) + '%"></i></div><small>' + vm.maxLvl + '</small></div>' +
      '<div class="sc-mind" title="' + esc(vm.cons.title) + ' ' + vm.cons.label + vm.cons.n + '">' + [1,2,3,4,5,6].map(i => '<i class="' + (i <= vm.cons.n ? "on" : "") + '">' + i + '</i>').join("") +
        '<b>' + vm.cons.label + vm.cons.n + '</b></div>' +
      '<div class="sc-keys">' + vm.keys.map(k => '<div><span>' + esc(k[0]) + '</span><b class="num">' + esc(k[1]) + '</b></div>').join("") + '</div>' +
      '<div class="sc-skills">' + vm.skills.map(s => '<span title="' + esc(s[0]) + ': ' + s[1] + '"><i>' + esc(s[0]) + '</i><b>' + s[1] + '</b></span>').join("") + '</div>' +
      '<p class="sc-when">' + (inShow ? "В витрине сейчас" : "Сборка от " + rec.at.slice(0, 10).split("-").reverse().join(".") + ", сейчас не в витрине") +
        ' · обновлено ' + new Date(u.at).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) + '</p>' +
    '</div></div>';

  h += '<div class="sc-cols"><div class="sc-panel"><div class="sc-ptitle">Характеристики</div><div class="sc-stats">' + vm.stats.map(r =>
      '<div class="sc-stat' + (r.hl ? " hl" : "") + '"><span>' + esc(r.n) + '</span><b class="num">' + esc(r.v) +
        (r.base ? '<small>' + esc(r.base) + ' <em>+' + esc(r.add) + '</em></small>' : "") + '</b></div>').join("") + '</div></div>';

  h += '<div class="sc-side">';
  const w = vm.weapon;
  if(w){
    h += '<div class="sc-panel sc-weapon' + (w.top ? " r4" : "") + '"><div class="sc-ptitle">' + esc(w.title) + '</div><div class="sc-wbody">' +
      '<div class="sc-wimg' + (w.tall ? " tall" : "") + '"><span>' + esc(w.badge) + '</span>' + (w.img ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(w.img)) + '" onerror="this.remove()">' : "") + '</div>' +
      '<div class="sc-winfo"><div class="sc-wname">' + esc(w.name) + '</div>' +
      '<div class="sc-wmeta"><span>Ур. ' + w.lvl + '</span>' + scPips(w.refine.n, 5) + '<b>' + w.refine.label + w.refine.n + '</b></div>' +
      w.stats.map(s => '<div class="sc-wstat"><span>' + esc(s[0]) + '</span><b class="num">' + esc(s[1]) + '</b></div>').join("") +
      '</div></div></div>';
  } else h += '<div class="sc-panel sc-weapon none"><div class="sc-ptitle">Снаряжение</div>Не экипировано</div>';
  h += '<div class="sc-panel"><div class="sc-ptitle">Комплекты</div>' + (vm.sets.length ? '<div class="sc-sets">' + vm.sets.map(s =>
      '<div class="sc-set' + (s.full ? " full" : "") + '">' + (s.icon ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(s.icon)) + '" onerror="this.remove()">' : '<i></i>') +
      '<span>' + esc(s.name) + '</span><b>' + (s.full ? "4" : "2") + '</b></div>').join("") + '</div>' : '<p class="sc-none">Нет собранных комплектов</p>') +
    '<div class="sc-cv"><span>Крит. ценность ' + esc(vm.setsWord) + '</span><b class="num">' + (Math.round(vm.cv / 10) / 10).toLocaleString("ru-RU") + '</b></div></div>';
  h += '</div></div>';

  h += '<div class="sc-ptitle sc-dtitle">' + esc(vm.slotsTitle) + '</div><div class="sc-discs' + (vm.slots.length === 5 ? " five" : "") + '">';
  vm.slots.forEach(d => {
    if(d.empty){ h += '<div class="sc-disc none"><em class="sc-slot">' + d.pos + '</em><p>' + esc(d.label.length > 2 ? d.label + " — пусто" : "Пусто") + '</p></div>'; return; }
    h += '<div class="sc-disc' + (d.top ? " r4" : "") + '">' +
      (d.icon ? '<img class="sc-dmark" alt="" referrerpolicy="no-referrer" src="' + esc(scImg(d.icon)) + '" onerror="this.remove()">' : "") +
      '<div class="sc-dhead"><em class="sc-slot">' + d.pos + '</em><span>' + (d.label.length > 2 ? '<b>' + esc(d.label) + '</b> · ' : "") + esc(d.set || "") + '</span><i>+' + d.lvl + '</i></div>' +
      (d.main ? '<div class="sc-dmain"><span>' + esc(d.main[0]) + '</span><b class="num">' + esc(d.main[1]) + '</b></div>' : "") +
      '<div class="sc-dsubs">' + d.subs.map(s => '<div class="sc-dsub' + (s.val ? " val" : "") + '"><span>' + esc(s.n) + '</span>' +
        (s.up > 0 ? '<i title="Усилений: ' + s.up + '">' + "•".repeat(Math.min(5, s.up)) + '</i>' : "<i></i>") +
        '<b class="num">' + esc(s.v) + '</b></div>').join("") + '</div></div>';
  });
  h += '</div><p class="hint sc-foot">' + esc(vm.foot) + ' Точки у дополнительных характеристик — сколько раз она усиливалась; золотом — полезные этому персонажу.</p>';
  card.innerHTML = h;
}

document.getElementById("scLoad").onclick = scFetch;
document.getElementById("scUid").addEventListener("keydown", e => { if(e.key === "Enter") scFetch(); });
document.getElementById("scPick").onclick = () => document.getElementById("scFile").click();
document.getElementById("scFile").onchange = e => { const f = e.target.files[0]; if(f) scFile(f); e.target.value = ""; };

/* адрес посредника в настройках */
(function(){
  const inp = document.getElementById("enkaProxy");
  inp.value = ui.enkaProxy || "";
  document.getElementById("openSettings").addEventListener("click", () => { inp.value = ui.enkaProxy || ""; });
  const hint = inp.closest(".editrow").nextElementSibling;
  const hint0 = hint ? hint.textContent : "";
  const say = t => { if(hint) hint.textContent = t; };
  inp.addEventListener("change", () => {
    // принимаем адрес в любом виде: без https://, с хвостом /api/… или со слешем в конце
    let v = inp.value.trim().replace(/\s+/g, "");
    if(v && !/^[a-z]+:\/\//i.test(v)) v = "https://" + v;
    v = v.replace(/^http:\/\//i, "https://").replace(/\/api(\/.*)?$/i, "").replace(/\/+$/, "");
    if(v){
      let ok = false;
      try { const u = new URL(v); ok = u.protocol === "https:" && /\./.test(u.hostname); v = u.origin; } catch(e){}
      if(!ok){ inp.value = ui.enkaProxy || ""; say("Не похоже на адрес — пример: https://имя.аккаунт.workers.dev"); return; }
      ui.enkaProxy = v; inp.value = v; say("Сохранено: витрина будет загружаться через " + v);
    } else { delete ui.enkaProxy; say(hint0); }
    saveUI();
  });
})();
