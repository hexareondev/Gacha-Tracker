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
function zxCard(vm, uid){
  const half = Math.ceil(vm.stats.length / 2);
  const col = list => list.map(r => '<div class="zx-st' + (r.hl ? " hl" : "") + '">' + ic(r.ic) + '<span class="zx-l">' + esc(r.n) + '</span><span class="zx-dots"></span>' +
    '<span class="zx-v"><b>' + esc(r.v) + '</b>' + (r.base ? '<small>' + esc(r.base) + ' + <em>' + esc(r.add) + '</em></small>' : "") + "</span></div>").join("");
  // сводка: сколько раз выпадала каждая доп. характеристика и сколько дала в сумме
  const sum = {};
  vm.slots.forEach(d => (d.subs || []).forEach(s => {
    const k = s.key; sum[k] = sum[k] || { n:0, v:0, ic:s.ic, fmt:s.fmt, name:s.n };
    sum[k].n += s.up + 1; sum[k].v += s.raw;
  }));
  const core = vm.skills.find(s => s[0] === "Ядро");
  const coreN = core && core[1] !== "—" ? "ABCDEF".indexOf(core[1]) + 1 : 0;
  let h = '<div class="zx" style="--accent:' + esc(vm.color) + '">' +
    '<div class="zx-art">' + (vm.art ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(scImg(vm.art)) + '" onerror="this.remove()">' : "") +
      '<div class="zx-uid">' + esc(uid || "") + '</div>' +
      '<div class="zx-id"><div class="zx-lv">Уровень <b>' + vm.lvl + '</b> / ' + vm.maxLvl + '</div><div class="zx-nm">' + esc(vm.name) + '</div></div></div>' +
    '<div class="zx-mind">' + [1,2,3,4,5,6].map(i => '<i class="' + (i <= vm.cons.n ? "on" : "") + '">0' + i + "</i>").join("") + '</div>' +
    '<div class="zx-mid"><div class="zx-stats"><div>' + col(vm.stats.slice(0, half)) + '</div><div>' + col(vm.stats.slice(half)) + '</div></div>' +
      '<div class="zx-low"><div class="zx-core">' + "ABCDEF".split("").map((l, i) => '<i class="' + (i < coreN ? "on" : "") + '">' + l + "</i>").join("") + '</div>' +
        (vm.weapon ? '<div class="zx-w"><div class="zx-wn">' + esc(vm.weapon.name) + '</div><div class="zx-wst">' + vm.weapon.stats.map(s => '<span>' + esc(s[1]) + "</span>").join("") + '</div>' +
          xImg(vm.weapon.img, "zx-wimg") + '<em class="zx-p">' + vm.weapon.refine.label + vm.weapon.refine.n + '</em><em class="zx-wl">Lv. ' + vm.weapon.lvl + '</em></div>' : "") + '</div>' +
      '<div class="zx-low2"><div class="zx-skills">' + vm.skills.filter(s => s[0] !== "Ядро").map(s => '<span title="' + esc(s[0]) + '"><i>' + esc(s[0].charAt(0)) + '</i><b>' + s[1] + "</b></span>").join("") + '</div>' +
        '<div class="zx-sets">' + vm.sets.map(s => '<div>' + esc(s.name) + ' ' + xImg(s.icon, "zx-sicon") + '<b>×' + (s.full ? 4 : 2) + "</b></div>").join("") + '</div></div>' +
    '</div>' +
    '<div class="zx-discs">' + vm.slots.map(d => d.empty ? '<div class="zx-d none"><div class="zx-db"><b>' + d.pos + '</b></div><p>Пусто</p></div>' :
      '<div class="zx-d' + (d.top ? " top" : "") + '"><div class="zx-db">' + xImg(d.icon, "zx-dicon") + '<b>' + (d.main ? esc(d.main[1]) : "") + '</b>' + (d.main ? ic(d.main[2]) : "") + '<em>Lv. ' + d.lvl + '</em></div>' +
        '<div class="zx-ds">' + d.subs.map(s => '<span class="' + (s.val ? "val" : "") + '">' + ic(s.ic) + '<b>' + esc(s.v) + '</b>' + (s.up ? '<u style="width:' + (s.up * 8 - 2) + 'px"></u>' : "") + "</span>").join("") + "</div></div>").join("") + '</div>' +
    '<div class="zx-bar">' + Object.keys(sum).sort((a, b) => sum[b].n - sum[a].n).map(k => '<span title="' + esc(sum[k].name) + '"><small>' + sum[k].n + '</small>' + ic(sum[k].ic) + '<b>' + esc(sum[k].fmt(sum[k].v)) + "</b></span>").join("") + '</div>' +
  '</div>';
  return h;
}

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
