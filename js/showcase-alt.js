"use strict";
/* ── витрина: вид «как в игре» (тестовый) ──
   Три раскладки по мотивам игровых экранов: Genshin — окно персонажа HoYoLAB,
   Star Rail — карточка HoYoLAB с сеткой реликвий, ZZZ — широкая карточка в духе Enka.
   Берут ту же модель карточки (vm), что и обычный вид. */

// маленькие значки характеристик
const SC_ICON = {
  hp:  '<path d="M8 2C6 5 4 7 4 9.5A4 4 0 0 0 12 9.5C12 7 10 5 8 2Z"/>',
  atk: '<path d="M3 13l7-7M10 3l3 3-5 5-3-3zM3 13l2-.5L3.5 11z"/>',
  def: '<path d="M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z"/>',
  spd: '<path d="M3 4l5 4-5 4M8 4l5 4-5 4"/>',
  cr:  '<path d="M8 1.5l1.6 4.4 4.6.3-3.6 2.9 1.2 4.5L8 11l-3.8 2.6 1.2-4.5L1.8 6.2l4.6-.3z"/>',
  cd:  '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/>',
  em:  '<circle cx="8" cy="8" r="1.6"/><ellipse cx="8" cy="8" rx="6" ry="2.4"/><ellipse cx="8" cy="8" rx="6" ry="2.4" transform="rotate(60 8 8)"/><ellipse cx="8" cy="8" rx="6" ry="2.4" transform="rotate(120 8 8)"/>',
  er:  '<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.2h-2.2"/>',
  heal:'<path d="M6.5 2.5h3v4h4v3h-4v4h-3v-4h-4v-3h4z"/>',
  be:  '<path d="M9 1.5L4 9h3.5L6.5 14.5 12 6.5H8.5z"/>',
  ehr: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  res: '<path d="M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z"/><path d="M5.5 8l2 2 3-3.5"/>',
  dmg: '<path d="M8 1.5l5.5 6.5L8 14.5 2.5 8z"/>',
  imp: '<path d="M2 12l4-8 2 5 2-3 4 6z"/>',
  am:  '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11M2.5 8h11"/>',
  ap:  '<circle cx="8" cy="8" r="5.5"/><path d="M5 8h6M8 5v6"/><circle cx="8" cy="8" r="2.4"/>',
  pen: '<path d="M2 8h9M8 4.5L11.5 8 8 11.5M13.5 3v10"/>',
  penr:'<path d="M2 8h9M8 4.5L11.5 8 8 11.5"/><circle cx="13" cy="4" r="1.2"/><circle cx="13" cy="12" r="1.2"/>',
  dot: '<circle cx="8" cy="8" r="2.5"/>',
  lock:'<rect x="3.5" y="7" width="9" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'
};
function ic(k, cls){
  // картинка-маска: цвет берётся из currentColor, как у SVG
  if(typeof k === "string" && k.indexOf("hsr:") === 0) return '<i class="xi xim' + (cls ? " " + cls : "") + '" style="-webkit-mask-image:url(icons/hsr/' + k.slice(4) + '.webp);mask-image:url(icons/hsr/' + k.slice(4) + '.webp)" aria-hidden="true"></i>';
  if(typeof k === "string" && k.indexOf("zzz:") === 0) return '<i class="xi xim' + (cls ? " " + cls : "") + '" style="-webkit-mask-image:url(icons/zzz/' + k.slice(4) + '.webp);mask-image:url(icons/zzz/' + k.slice(4) + '.webp)" aria-hidden="true"></i>';
  if(typeof k === "string" && k.indexOf("zimg:") === 0) return '<img class="xi xig' + (cls ? " " + cls : "") + '" src="icons/zzz/' + k.slice(5) + '.webp" alt="" aria-hidden="true">';
  return '<svg class="xi' + (cls ? " " + cls : "") + '" viewBox="0 0 16 16" aria-hidden="true">' + (SC_ICON[k] || SC_ICON.dot) + "</svg>"; }
function xImg(path, cls, letter){
  return '<span class="ximg ' + (cls || "") + '">' + (letter ? '<b>' + esc(letter) + '</b>' : "") +
    (path ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(path)) + '" onerror="this.remove()">' : "") + "</span>";
}
function xStatRow(r){
  return '<div class="xrow' + (r.hl ? " hl" : "") + '">' + ic(r.ic) + '<span class="xl">' + esc(r.n) + '</span>' +
    (r.base ? '<span class="xba"><i>' + esc(r.base) + '</i><em>+' + esc(r.add) + '</em></span>' : "") + '<b>' + esc(r.v) + "</b></div>";
}

/* ── Genshin: окно персонажа HoYoLAB ── */
function gxCard(vm){
  const stars = "★".repeat(vm.rarity || 5);
  const consY = [0, 1, 2, 3, 4, 5].map(i => { const t = (i - 2.5) / 2.5; return Math.round(18 - 18 * t * t); });   // дуга
  let h = '<div class="gx" style="--accent:' + esc(vm.color) + '">' +
    '<div class="gx-left"><div class="gx-art">' + (vm.art ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(vm.art)) + '" onerror="this.remove()">' : "") + '</div>' +
      '<div class="gx-cons">' + consY.map((x, i) => '<i class="' + (i < vm.cons.n ? "on" : "") + '" style="transform:translateX(' + x + 'px)">' + (i < vm.cons.n ? '<b>C' + (i + 1) + '</b>' : ic("lock")) + "</i>").join("") + '</div>' +
      (vm.friend ? '<div class="gx-friend">' + ic("heal") + 'Уровень дружбы: <b>' + vm.friend + '</b></div>' : "") +
      '<div class="gx-talents">' + vm.skills.map(s => '<span title="' + esc(s[0]) + '"><i>' + esc(s[0].charAt(0)) + '</i><b>' + s[1] + "</b></span>").join("") + '</div>' +
    '</div>' +
    '<div class="gx-right">' +
      '<div class="gx-head"><span class="gx-el">' + ic("dmg") + '</span><div><div class="gx-name">' + esc(vm.name) + ' <em>Ур. ' + vm.lvl + '</em></div><div class="gx-stars">' + stars + ' <small>' + esc(vm.el + " · " + vm.cls) + '</small></div></div></div>' +
      '<div class="gx-panel"><div class="gx-pt">Характеристики персонажа</div><div class="gx-grid">' + vm.stats.map(xStatRow).join("") + '</div></div>';
  if(vm.weapon){
    const w = vm.weapon;
    h += '<div class="gx-panel"><div class="gx-pt">Оружие</div><div class="gx-weapon">' + xImg(w.img, "gx-wimg r" + (w.top ? 5 : 4)) + '<em class="gx-ref">' + w.refine.n + '</em>' +
      '<div><div class="gx-wname">' + esc(w.name) + ' <em>Ур. ' + w.lvl + '</em></div>' + w.stats.map(s => '<div class="gx-ws">' + esc(s[0]) + ': ' + esc(s[1]) + "</div>").join("") + '</div></div></div>';
  }
  h += '<div class="gx-panel"><div class="gx-pt">Артефакты' + (vm.sets.length ? ' <small>' + vm.sets.map(s => esc(s.name) + (s.full ? " ×4" : " ×2")).join(" · ") + '</small>' : "") + '</div><div class="gx-arts">' +
    vm.slots.map(d => d.empty ? '<div class="gx-art-i none">' + esc(d.label) + '</div>' :
      '<div class="gx-art-i">' + xImg(d.icon, "gx-aimg") + '<em>+' + d.lvl + '</em>' +
        (d.main ? '<div class="gx-am">' + ic(d.main[2]) + '<b>' + esc(d.main[1]) + '</b></div>' : "") +
        d.subs.map(s => '<div class="gx-as' + (s.val ? " val" : "") + '">' + ic(s.ic) + '<span>' + esc(s.v) + '</span>' + (s.up ? '<i>' + "·".repeat(s.up) + "</i>" : "") + "</div>").join("") + "</div>").join("") +
    '</div></div></div></div>';
  return h;
}

/* ── Star Rail: раскладка HoYoLAB в цветах трекера ── */
function hxImg(path, cls, extra){
  return '<span class="ximg ' + cls + '">' + (extra || "") + (path ? '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(scImg(path)) + '" onerror="this.remove()">' : "") + "</span>";
}
function hxCard(vm){
  const t = vm.traces || { skills:[], majors:[], minors:[], bonus:[] };
  let h = '<div class="hx" style="--accent:' + esc(vm.color) + '">' +
    '<div class="hx-left">' +
      '<div class="hx-art">' + (vm.art ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(vm.art)) + '" onerror="this.remove()">' : "") +
        '<div class="hx-name">' + esc(vm.name) + ' <em>Ур. ' + vm.lvl + '</em></div>' +
        '<div class="hx-tags"><span class="el"><i></i>' + esc(vm.el) + '</span><span>' + esc(vm.cls) + '</span></div>' +
        '<div class="hx-eid">' + [1,2,3,4,5,6].map(i => hxImg((vm.rankIcons || [])[i - 1], "hx-e" + (i <= vm.cons.n ? " on" : ""), i <= vm.cons.n ? "" : ic("lock", "lk"))).join("") + '</div>' +
      '</div>';
  if(vm.weapon){
    const w = vm.weapon;
    h += '<div class="hx-box"><div class="hx-bt">Световой конус</div><div class="hx-lc">' + hxImg(w.img, "hx-lcimg") +
      '<div><div class="hx-lcname' + (w.top ? " top" : "") + '">' + esc(w.name) + '</div><div class="hx-lcmeta">Ур. ' + w.lvl + ' · Наложение ур. ' + w.refine.n + '</div>' +
      w.stats.map(s => '<div class="hx-lcst">' + esc(s[0]) + ' <b>' + esc(s[1]) + "</b></div>").join("") + '</div></div></div>';
  }
  h += '<div class="hx-box"><div class="hx-bt">Следы</div>' +
      '<div class="hx-skills">' + t.skills.map(s => '<span title="' + esc(s.n) + ': ' + s.lv + '">' + hxImg(s.icon, "hx-sk") + '<b>' + s.lv + "</b></span>").join("") + '</div>' +
      (t.majors.length || t.minors.length ? '<div class="hx-nodes">' + t.majors.map(m => hxImg(m.icon, "hx-major" + (m.on ? " on" : ""))).join("") +
        t.minors.map(m => hxImg(m.icon, "hx-minor" + (m.on ? " on" : ""))).join("") + '</div>' : "") +
      (t.bonus.length ? '<div class="hx-tbonus">' + t.bonus.map(b => '<span>' + esc(b.n) + ' <b>' + esc(b.v) + "</b></span>").join("") + '</div>' : "") +
    '</div></div>';

  h += '<div class="hx-right"><div class="hx-title">Характеристики</div>' +
    '<div class="hx-box"><div class="hx-grid">' + vm.stats.map(xStatRow).join("") + '</div></div>';
  const uk = Object.keys(vm.useful || {}).sort((a, b) => vm.useful[b] - vm.useful[a]);
  const total = uk.reduce((s, k) => s + vm.useful[k], 0);
  h += '<div class="hx-box hx-relbox"><div class="hx-bt">Реликвии' + (vm.sets.length ? ' <small>' + vm.sets.map(s => esc(s.name) + (s.full ? " ×4" : " ×2")).join(" · ") + '</small>' : "") + '</div>' +
    (uk.length ? '<div class="hx-useful"><div><span class="hx-ut">Полезные усиления</span>' + uk.map(k => '<span class="hx-uc">' + esc(k) + ' <b>' + vm.useful[k] + "</b></span>").join("") +
      '</div><div class="hx-utot"><b>' + total + '</b><small>всего</small></div></div>' : "") +
    '<div class="hx-relics">' + vm.slots.map(d => d.empty ? '<div class="hx-rel none"><div class="hx-rh"><span>' + esc(d.label) + '</span></div><p>Пусто</p></div>' :
      '<div class="hx-rel' + (d.top ? " top" : "") + '"><div class="hx-rh"><span>' + esc(d.label) + ' <em>+' + d.lvl + '</em></span>' + hxImg(d.icon, "hx-ricon") + '</div>' +
        (d.main ? '<div class="hx-rm">' + ic(d.main[2]) + '<span>' + esc(d.main[0]) + '</span><b>' + esc(d.main[1]) + '</b></div>' : "") +
        d.subs.map(s => '<div class="hx-rs' + (s.val ? " val" : "") + '">' + ic(s.ic) + '<span>' + esc(s.n) + (s.up ? ' <i>»' + s.up + '</i>' : "") + '</span><b>' + esc(s.v) + "</b></div>").join("") + "</div>").join("") +
    '</div></div></div></div>';
  return h;
}
function toRoman(n){ return ["", "I", "II", "III", "IV", "V", "VI"][n] || n; }

/* ── ZZZ: широкая карточка в духе Enka ── */
// порядок нижней сводки: HP%, HP, сила атаки %, сила атаки, защита %, защита, крит. шанс, крит. урон, знание аномалии, пробивание
const ZX_BAR = ["11102", "11103", "12102", "12103", "13102", "13103", "20103", "21103", "31203", "23203"];
function zxBarPos(k){ const i = ZX_BAR.indexOf(String(k)); return i === -1 ? 99 : i; }
function zxCard(vm, uid){
  const half = Math.ceil(vm.stats.length / 2);
  const col = list => list.map(r => '<div class="zx-st' + (r.hl ? " hl" : "") + '" data-f="' + esc(r.f || "") + '">' + ic(r.ic) + '<span class="zx-l">' + esc(r.n) + '</span><span class="zx-dots"></span>' +
    '<span class="zx-v"><b>' + esc(r.v) + '</b>' + (r.base ? '<small>' + esc(r.base) + ' + <em>' + esc(r.add) + '</em></small>' : "") + "</span></div>").join("");
  // сводка: сколько раз выпадала каждая доп. характеристика и сколько дала в сумме
  const sum = {};
  vm.slots.forEach(d => (d.subs || []).forEach(s => {
    const k = s.key; sum[k] = sum[k] || { n:0, v:0, ic:s.ic, fmt:s.fmt, name:s.n, val:s.val };
    sum[k].n += s.up + 1; sum[k].v += s.raw;
  }));
  const core = vm.skills.find(s => s[0] === "Ядро");
  const coreN = core && core[1] !== "—" ? "ABCDEF".indexOf(core[1]) + 1 : 0;
  // навыки в порядке окна агента: атака, уклонение, помощь, особая, цепочка
  const order = [0, 2, 6, 1, 3];
  const skills = vm.skills.filter(s => ZZZ_SKILL_IC[s[2]]).sort((a, b) => order.indexOf(a[2]) - order.indexOf(b[2]));
  const zImg = (name, cls) => name ? '<img class="' + cls + '" src="icons/zzz/' + name + '.webp" alt="">' : "";
  // столбец кинограммы: 6 ячеек, пустая, специализация, стихия
  const mind = [1,2,3,4,5,6].map(i => '<i class="' + (i <= vm.cons.n ? "on" : "") + '"><span>0' + i + "</span></i>").join("") +
    '<i class="blank"></i><i class="ic" title="' + esc(vm.cls || "") + '">' + (vm.proIc ? zImg("sp_" + vm.proIc, "") : '<span>' + esc((vm.cls || "").slice(0, 3)) + "</span>") + '</i>' +
    '<i class="ic" title="' + esc(vm.el || "") + '">' + zImg(vm.elIc && "el_" + vm.elIc, "") + "</i>";
  let h = '<div class="zx" style="--accent:' + esc(vm.color) + '">' +
    '<div class="zx-art">' + (vm.art ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(vm.art)) + '" onerror="this.remove()">' : "") +
      '<div class="zx-uid">' + esc(uid || "") + '</div>' +
      '<div class="zx-id"><div class="zx-lv">Уровень <b>' + vm.lvl + '</b> / ' + vm.maxLvl + '</div><div class="zx-nm">' + esc(vm.name) + '</div></div></div>' +
    '<div class="zx-mind"><div class="zx-mind-in">' + mind + '</div></div>' +
    '<div class="zx-mid"><div class="zx-mid-in"><div class="zx-stats"><div>' + col(vm.stats.slice(0, half)) + '</div><div>' + col(vm.stats.slice(half)) + '</div></div>' +
      '<div class="zx-low"><div class="zx-core">' + "ABCDEF".split("").map((l, i) => '<i class="' + (i < coreN ? "on" : "") + '">' + l + "</i>").join("") + '</div>' +
        (vm.weapon ? '<div class="zx-w"><div class="zx-wn">' + esc(vm.weapon.name) + '</div><div class="zx-wst">' + vm.weapon.stats.map(s => '<span' + (s[3] ? ' data-f="' + esc(s[3]) + '"' : "") + '>' + (s[2] ? ic(s[2]) : "") + esc(s[1]) + "</span>").join("") + '</div>' +
          xImg(vm.weapon.img, "zx-wimg") + '<em class="zx-p">' + vm.weapon.refine.label + vm.weapon.refine.n + '</em><em class="zx-wl">Lv. ' + vm.weapon.lvl + '</em></div>' : "") + '</div>' +
      '<div class="zx-low2"><div class="zx-skills">' + skills.map(s => '<span title="' + esc(s[0]) + '">' + zImg("sk_" + ZZZ_SKILL_IC[s[2]], "zx-skimg") + '<b>' + s[1] + "</b></span>").join("") + '</div>' +
        '<div class="zx-sets">' + vm.sets.map(s => '<div><span>' + esc(s.name) + '</span>' + xImg(s.icon, "zx-sicon") + '<b>×' + (s.full ? 4 : 2) + "</b></div>").join("") + '</div></div>' +
    '</div></div>' +
    '<div class="zx-discs">' + vm.slots.map(d => d.empty ? '<div class="zx-d none"><div class="zx-box"><div class="zx-vin"></div><div class="zx-sq"><div class="zx-sqi"><b>' + d.pos + '</b></div></div></div><p>Пусто</p></div>' :
      '<div class="zx-d r' + (d.rank || "B") + '"><div class="zx-box"><div class="zx-vin">' + xImg(d.icon, "zx-dicon") + '</div>' +
        '<div class="zx-sq">' +
          '<div class="zx-sqi"><div class="zx-sq1"' + (d.main ? ' data-f="' + esc(d.main[3]) + '"' : "") + '><b>' + (d.main ? esc(d.main[1]) : "") + '</b>' + (d.main ? ic(d.main[2]) : "") + '</div>' +
          '<div class="zx-sq2"><em>Lv. ' + d.lvl + '</em><s>' + esc(d.rank || "B") + '</s></div></div></div></div>' +
        '<div class="zx-ds">' + d.subs.map(s => '<span class="' + (s.val ? "val" : "") + '" data-f="' + esc(String(s.key).slice(0, 3)) + '">' + ic(s.ic) + '<b>' + esc(s.v) + '</b>' + (s.up ? '<u style="width:' + (s.up * 8 - 2) + 'px"></u>' : "") + "</span>").join("") + "</div></div>").join("") + '</div>' +
    '<div class="zx-bar">' + Object.keys(sum).sort((a, b) => zxBarPos(a) - zxBarPos(b)).map(k => '<span' + (sum[k].val ? ' class="val"' : "") + ' title="' + esc(sum[k].name) + '" data-f="' + esc(String(k).slice(0, 3)) + '"><small>' + sum[k].n + '</small>' + ic(sum[k].ic) + '<b>' + esc(sum[k].fmt(sum[k].v)) + "</b></span>").join("") + '</div>' +
  '</div>';
  return h;
}

// ZZZ: наведение на характеристику подсвечивает её в дисках и в нижней сводке
document.addEventListener("mouseover", e => {
  const el = e.target.closest && e.target.closest(".zx [data-f]");
  const card = e.target.closest && e.target.closest(".zx");
  document.querySelectorAll(".zx .zx-on").forEach(x => { if(!el || x.dataset.f !== el.dataset.f || !card.contains(x)) x.classList.remove("zx-on"); });
  if(el && el.dataset.f) card.querySelectorAll('[data-f="' + el.dataset.f + '"]').forEach(x => x.classList.add("zx-on"));
});

// переключатель вида
// вид карточки выбирается отдельно для каждой игры; по умолчанию «как в игре» только у Star Rail
const SC_ALT_DEFAULT = { hkrpg:1 };
function scAltWanted(game){
  const v = (ui.scLayoutG || {})[game];
  return v ? v === "game" : !!SC_ALT_DEFAULT[game];
}
function scLayoutSeg(game){
  const box = document.getElementById("scLayout");
  box.innerHTML = "";
  const cur = scAltWanted(game) ? "game" : "tracker";
  [["tracker", "Трекер"], ["game", "Как в игре"]].forEach(([v, t]) => {
    const b = document.createElement("button");
    b.textContent = t;
    b.className = v === cur ? "on" : "";
    b.onclick = () => { ui.scLayoutG = ui.scLayoutG || {}; ui.scLayoutG[game] = v; saveUI(); renderShowcase(); };
    box.appendChild(b);
  });
}
function scRenderAlt(card, game, vm, uid){
  card.innerHTML = game === "hk4e" ? gxCard(vm) : game === "hkrpg" ? hxCard(vm) : zxCard(vm, uid);
}


/* ── карточка витрины в PNG: копия разметки + стили сайта внутри SVG, все картинки и шрифты вшиты как data:URL ── */
async function scToDataUrl(url){
  try {
    const r = await fetch(url, { mode:"cors", referrerPolicy:"no-referrer", cache:"force-cache" });
    if(!r.ok) return null;
    const b = await r.blob();
    return await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => res(null); f.readAsDataURL(b); });
  } catch(e){ return null; }
}
let scFontCss = null;
async function scFonts(){
  if(scFontCss !== null) return scFontCss;
  scFontCss = "";
  const link = document.querySelector('link[href*="fonts.googleapis"]');
  if(!link) return "";
  try {
    let css = await (await fetch(link.href)).text();
    // берём только латиницу и кириллицу, остальные наборы символов не нужны
    const blocks = css.split("/*").filter(b => /^\s*(latin|cyrillic)\s*\*\//.test(b)).map(b => b.slice(b.indexOf("*/") + 2));
    const out = [];
    for(const b of blocks){
      const m = b.match(/url\((https:[^)]+)\)/);
      if(!m) continue;
      const d = await scToDataUrl(m[1]);
      if(d) out.push(b.replace(m[1], d));
    }
    scFontCss = out.join("\n");
  } catch(e){}
  return scFontCss;
}
let scCssText = null;
async function scCardPng(node){
  if(scCssText === null){
    const href = (document.querySelector('link[href*="css/style.css"]') || {}).href || "css/style.css";
    try { scCssText = await (await fetch(href)).text(); } catch(e){ scCssText = ""; }
  }
  const fonts = await scFonts();
  const w = Math.ceil(node.getBoundingClientRect().width), h = Math.ceil(node.getBoundingClientRect().height);
  const clone = node.cloneNode(true);
  clone.querySelectorAll(".zx-on").forEach(x => x.classList.remove("zx-on"));
  // картинки → data:URL; не отдалась (нет CORS) — убираем, чтобы холст не «испортился»
  let lost = 0;
  await Promise.all([...clone.querySelectorAll("img")].map(async im => {
    const d = im.getAttribute("src") ? await scToDataUrl(im.src) : null;
    if(d){ im.setAttribute("src", d); im.removeAttribute("loading"); } else { im.remove(); lost++; }
  }));
  // иконки-маски в style="mask-image:url(...)"
  await Promise.all([...clone.querySelectorAll('[style*="url("]')].map(async el => {
    const st = el.getAttribute("style"), urls = [...new Set((st.match(/url\(([^)]+)\)/g) || []).map(u => u.slice(4, -1).replace(/["']/g, "")))];
    let out = st;
    for(const u of urls){ const d = await scToDataUrl(new URL(u, location.href).href); if(d) out = out.split(u).join(d); }
    el.setAttribute("style", out);
  }));
  // переменные цветов с :root, чтобы карточка выглядела как на сайте
  const rs = getComputedStyle(document.documentElement);
  const vars = [...new Set(scCssText.match(/--[\w-]+(?=\s*:)/g) || [])].map(v => v + ":" + rs.getPropertyValue(v)).join(";");
  const body = getComputedStyle(document.body);
  const attr = v => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const wrap = '<div xmlns="http://www.w3.org/1999/xhtml" style="' + attr(vars + ";width:" + w + "px;font-family:" + body.fontFamily + ";color:" + body.color) + '">' +
    "<style><![CDATA[" + (fonts + "\n" + scCssText).replace(/]]>/g, "") + "]]></style>" + new XMLSerializer().serializeToString(clone) + "</div>";
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject x="0" y="0" width="100%" height="100%">' + wrap + "</foreignObject></svg>";
  const bad = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror");
  if(bad) throw new Error("svg: " + bad.textContent.slice(0, 200));
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  const k = 2, cv = document.createElement("canvas");
  cv.width = w * k; cv.height = h * k;
  const ctx = cv.getContext("2d");
  ctx.scale(k, k);
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#111";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise(res => { try { cv.toBlob(res, "image/png"); } catch(e){ res(null); } });
  return { blob, lost };
}
document.getElementById("scPng").addEventListener("click", async e => {
  const btn = e.currentTarget, node = document.querySelector("#scCard > *");
  if(!node || btn.disabled) return;
  const t = btn.textContent;
  btn.disabled = true; btn.textContent = "Рисую…";
  try {
    const r = await scCardPng(node);
    if(!r.blob) throw new Error("png");
    const name = ((document.querySelector(".zx-nm,.hx-name,.gx-name,.sc-card h2") || {}).textContent || "card").split(" Ур.")[0].trim().replace(/[\\/:*?"<>|]+/g, "") + ".png";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(r.blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    if(r.lost) document.getElementById("scNote").textContent = "Картинка сохранена, но " + r.lost + " изображений Enka не отдал для рисования — на PNG их нет.";
  } catch(err){ console.error(err); document.getElementById("scNote").textContent = "Не получилось нарисовать картинку."; }
  finally { btn.disabled = false; btn.textContent = t; }
});
