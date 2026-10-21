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
  if(typeof k === "string" && k.indexOf("gi:") === 0) return '<i class="xi xim' + (cls ? " " + cls : "") + '" style="-webkit-mask-image:url(icons/gi/' + k.slice(3) + '.webp);mask-image:url(icons/gi/' + k.slice(3) + '.webp)" aria-hidden="true"></i>';
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
/* фон Genshin: ночное небо в цвете стихии и созвездие из звёзд и линий; у каждого персонажа своё */
function gxSky(color, seedText){
  let seed = 7; for(const ch of String(seedText || "")) seed = (seed * 33 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const hex = /^#?([0-9a-f]{6})$/i.exec(color || "") ? color.replace("#", "") : "f0c264";
  const rgb = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16)).join(",");
  let stars = "";
  for(let i = 0; i < 80; i++){
    const r = rnd() < .92 ? .35 + rnd() * .6 : 1 + rnd();
    stars += '<circle cx="' + (rnd() * 400).toFixed(1) + '" cy="' + (rnd() * 600).toFixed(1) + '" r="' + r.toFixed(2) + '" fill="#fff" opacity="' + (.2 + rnd() * .7).toFixed(2) + '"/>';
  }
  // созвездие: 7 звёзд в верхней половине, соединённых линиями
  const pts = [];
  for(let i = 0; i < 7; i++) pts.push([40 + rnd() * 320, 40 + rnd() * 260]);
  pts.sort((a, b) => a[0] - b[0]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const cstars = pts.map(p => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.4" fill="#fff"/><circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="7" fill="rgb(' + rgb + ')" opacity=".35"/>').join("");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">' +
    '<radialGradient id="g" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="rgb(' + rgb + ')" stop-opacity=".45"/><stop offset=".55" stop-color="rgb(' + rgb + ')" stop-opacity=".12"/><stop offset="1" stop-color="#05070d" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="h" cx="50%" cy="100%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<rect width="400" height="600" fill="#060810"/><rect width="400" height="600" fill="url(#g)"/><rect width="400" height="600" fill="url(#h)"/>' +
    '<circle cx="200" cy="250" r="150" fill="none" stroke="rgb(' + rgb + ')" stroke-opacity=".18" stroke-width="1"/><circle cx="200" cy="250" r="185" fill="none" stroke="rgb(' + rgb + ')" stroke-opacity=".1" stroke-width="1" stroke-dasharray="2 6"/>' +
    stars + '<path d="' + line + '" fill="none" stroke="rgb(' + rgb + ')" stroke-opacity=".55" stroke-width="1.2"/>' + cstars + '</svg>';
  return 'url(&quot;data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29") + '&quot;)';
}
// оценка артефактов: полезные усиления (как у ZZZ) и крит-ценность (CV = 2 × крит. шанс + крит. урон)
const GX_FLAT = { FIGHT_PROP_ATTACK:"FIGHT_PROP_ATTACK_PERCENT", FIGHT_PROP_HP:"FIGHT_PROP_HP_PERCENT", FIGHT_PROP_DEFENSE:"FIGHT_PROP_DEFENSE_PERCENT" };
function gxGrade(vm){
  const val = vm.valuable || {}, useful = {};
  let n = 0;
  vm.slots.forEach(d => (d.subs || []).forEach(s => {
    const r = (s.up || 0) + 1;
    if(val[s.key]){ n += r; useful[s.n] = (useful[s.n] || 0) + r; }
    else if(GX_FLAT[s.key] && val[GX_FLAT[s.key]]) n += r / 3;
  }));
  n = Math.round(n * 10) / 10;
  const k = Math.min(4, Object.keys(val).filter(x => val[x]).length);
  const max = 5 * (k + 5), p = n / max;
  return { n, max, useful, g: p >= .7 ? "SS" : p >= .56 ? "S" : p >= .42 ? "A" : p >= .28 ? "B" : "C" };
}
// короткие подписи для узких карточек артефактов (полное название — во всплывающей подсказке)
function gxShort(n){
  return String(n).replace(/^Шанс крит(ического|\.) попадания$/, "Шанс крита").replace(/^Бонус (\S+) урона$/, "$1 урон")
    .replace(/^Сила атаки$/, "Атака").replace(/^Мастерство стихий$/, "Мастерство").replace(/^Восстановление энергии$/, "Восст. энергии");
}
function gxCard(vm){
  const gr = gxGrade(vm), stars = "★".repeat(vm.rarity || 5);
  const uk = Object.keys(gr.useful).sort((a, b) => gr.useful[b] - gr.useful[a]);
  // созвездия — дугой по правому краю арта, как в окне персонажа
  const arc = [0, 1, 2, 3, 4, 5].map(i => { const t = (i - 2.5) / 2.5; return Math.round(22 * t * t); });
  let h = '<div class="hx gi r' + (vm.rarity || 5) + '" style="--accent:' + esc(vm.color) + '">' +
    '<div class="hx-left">' +
      '<div class="hx-art" style="background-image:' + gxSky(vm.color, vm.name) + '">' + (vm.art ? '<img class="pre" alt="" referrerpolicy="no-referrer" src="' + esc(scImg(vm.art)) + '" onerror="this.remove()">' : "") +
        '<div class="hx-head"><div class="hx-name"><span class="fit">' + esc(vm.name) + '</span> <em>Ур. ' + vm.lvl + '</em></div>' +
        '<div class="hx-tags"><span class="el">' + (GI_EL_IC[vm.elKey] ? '<img class="gi-elic" src="icons/gi/el_' + GI_EL_IC[vm.elKey] + '.webp" alt="">' : "<i></i>") + esc(vm.el) + '</span><span>' + esc(vm.cls) + '</span><span class="gi-stars">' + stars + '</span></div></div>' +
        '<div class="gi-cons">' + [0,1,2,3,4,5].map(i => '<span style="margin-right:' + arc[i] + 'px">' + hxImg((vm.constIcons || [])[i], "gi-c" + (i < vm.cons.n ? " on" : ""), i < vm.cons.n ? "" : ic("lock", "lk")) + "</span>").join("") + '</div>' +
        (vm.friend ? '<div class="gi-friend">' + ic("heal") + ' Дружба <b>' + vm.friend + '</b></div>' : "") +
      '</div>';
  h += '</div><div class="hx-right"><div class="hx-title">Характеристики</div>' +
    '<div class="hx-box"><div class="hx-grid" style="grid-template-rows:repeat(' + Math.ceil(vm.stats.length / 2) + ',auto)">' + vm.stats.map(xStatRow).join("") + '</div></div><div class="gi-wt">';
  h += '<div class="hx-box"><div class="hx-bt">Таланты</div><div class="hx-skills gi-tal">' +
      (vm.talents || []).map(t => '<span title="' + esc(t.n) + ': ' + t.lv + (t.boost ? " (+3 от созвездия)" : "") + '">' + hxImg(t.icon, "hx-sk") + '<b' + (t.boost ? ' class="up"' : "") + '>' + t.lv + "</b><small>" + esc(t.n) + "</small></span>").join("") +
    '</div></div>';
  if(vm.weapon){
    const w = vm.weapon;
    h += '<div class="hx-box"><div class="hx-bt">Оружие</div><div class="hx-lc gi-w">' + hxImg(w.img, "hx-lcimg gi-wimg" + (w.top ? " top" : "")) +
      '<div><div class="hx-lcname' + (w.top ? " top" : "") + '">' + esc(w.name) + '</div><div class="hx-lcmeta">Ур. ' + w.lvl + ' · <em>R' + w.refine.n + '</em></div>' +
      w.stats.map(s => '<div class="hx-lcst">' + esc(s[0]) + ' <b>' + esc(s[1]) + "</b></div>").join("") + '</div></div></div>';
  }
  h += '</div></div>';

  h += '<div class="hx-box gi-rhead"><div class="hx-bt">Артефакты' + (vm.sets.length ? ' <small>' + vm.sets.map(s => esc(s.name) + (s.full ? " ×4" : " ×2")).join(" · ") + '</small>' : "") + '</div>' +
    '<div class="hx-useful"><div><span class="hx-ut">Полезные усиления</span>' + (uk.length ? uk.map(k => '<span class="hx-uc">' + esc(k) + ' <b>' + gr.useful[k] + "</b></span>").join("") : '<span class="hx-uc">нет</span>') +
      '<span class="hx-uc gi-cv">Крит-ценность <b>' + (Math.round((vm.cv || 0) / 10) / 10).toLocaleString("ru-RU") + '</b></span></div>' +
      '<div class="hx-utot gi-grade g' + gr.g + '" title="' + gr.n.toLocaleString("ru-RU") + ' полезных усилений из ' + gr.max + ' возможных"><b>' + gr.g + '</b><small>' + gr.n.toLocaleString("ru-RU") + ' / ' + gr.max + '</small></div></div></div>' +
    '<div class="hx-box gi-rels"><div class="hx-relics">' + vm.slots.map(d => d.empty ? '<div class="hx-rel none"><div class="hx-rh"><span>' + esc(d.label) + '</span></div><p>Пусто</p></div>' :
      '<div class="hx-rel' + (d.top ? " top" : "") + '"><div class="hx-rh"><span>' + esc(d.label) + ' <em>+' + d.lvl + '</em></span>' + hxImg(d.icon, "hx-ricon") + '</div>' +
        (d.main ? '<div class="hx-rm">' + ic(d.main[2]) + '<span title="' + esc(d.main[0]) + '">' + esc(gxShort(d.main[0])) + '</span><b>' + esc(d.main[1]) + '</b></div>' : "") +
        d.subs.map(s => '<div class="hx-rs' + (s.val ? " val" : "") + '">' + ic(s.ic) + '<span title="' + esc(s.n) + '"><em>' + esc(gxShort(s.n)) + '</em>' + (s.up ? '<i>»' + s.up + '</i>' : "") + '</span><b>' + esc(s.v) + "</b></div>").join("") + "</div>").join("") +
    '</div></div></div>';
  return h;
}

/* ── Star Rail: раскладка HoYoLAB в цветах трекера ── */
function hxImg(path, cls, extra){
  return '<span class="ximg ' + cls + '">' + (extra || "") + (path ? '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(scImg(path)) + '" onerror="this.remove()">' : "") + "</span>";
}
/* туманность за персонажем HSR: облака из шума в цвете стихии + звёзды; у каждого персонажа своя */
function hxNebula(color, seedText){
  let seed = 0; for(const ch of String(seedText || "")) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const hex = /^#?([0-9a-f]{6})$/i.exec(color || "") ? color.replace("#", "") : "8fa8ff";
  const c = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16) / 255);
  // второй оттенок — сдвиг к фиолетовому, как у космоса в HoYoLAB
  const c2 = [Math.min(1, c[0] * .6 + .35), c[1] * .45, Math.min(1, c[2] * .6 + .45)];
  const m = (k, v) => "0 0 0 0 " + v[0].toFixed(3) + " 0 0 0 0 " + v[1].toFixed(3) + " 0 0 0 0 " + v[2].toFixed(3) + " " + k;
  let stars = "";
  for(let i = 0; i < 90; i++){
    const r = rnd() < .9 ? .4 + rnd() * .7 : 1.1 + rnd() * 1.1;
    stars += '<circle cx="' + (rnd() * 400).toFixed(1) + '" cy="' + (rnd() * 600).toFixed(1) + '" r="' + r.toFixed(2) + '" fill="#fff" opacity="' + (.25 + rnd() * .75).toFixed(2) + '"/>';
  }
  const s1 = Math.floor(rnd() * 999), s2 = Math.floor(rnd() * 999);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">' +
    '<filter id="a" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .009" numOctaves="5" seed="' + s1 + '"/><feColorMatrix values="' + m("2.1 0 0 0 -.95", c) + '"/></filter>' +
    '<filter id="b" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="4" seed="' + s2 + '"/><feColorMatrix values="' + m("1.9 0 0 0 -.95", c2) + '"/></filter>' +
    '<radialGradient id="g" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="rgb(' + c.map(v => Math.round(v * 255)).join(",") + ')" stop-opacity=".35"/><stop offset="1" stop-color="#05060b" stop-opacity="0"/></radialGradient>' +
    '<rect width="400" height="600" fill="#05060b"/><rect width="400" height="600" filter="url(#b)" opacity=".7"/><rect width="400" height="600" filter="url(#a)"/>' +
    '<rect width="400" height="600" fill="url(#g)"/>' + stars + '</svg>';
  return 'url(&quot;data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29") + '&quot;)';
}
function hxCard(vm){
  const t = vm.traces || { skills:[], majors:[], minors:[], bonus:[] };
  let h = '<div class="hx" style="--accent:' + esc(vm.color) + '">' +
    '<div class="hx-left">' +
      '<div class="hx-art" style="background-image:' + hxNebula(vm.color, vm.name) + '">' + (vm.art ? '<img class="pre" alt="" referrerpolicy="no-referrer" src="' + esc(scImg(vm.art)) + '" onerror="this.remove()">' : "") +
        '<div class="hx-head"><div class="hx-name"><span class="fit">' + esc(vm.name) + '</span> <em>Ур. ' + vm.lvl + '</em></div>' +
        '<div class="hx-tags"><span class="el"><i></i>' + esc(vm.el) + '</span><span>' + esc(vm.cls) + '</span></div></div>' +
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
        d.subs.map(s => '<div class="hx-rs' + (s.val ? " val" : "") + '">' + ic(s.ic) + '<span><em>' + esc(s.n) + '</em>' + (s.up ? '<i>»' + s.up + '</i>' : "") + '</span><b>' + esc(s.v) + "</b></div>").join("") + "</div>").join("") +
    '</div></div></div></div>';
  return h;
}
function toRoman(n){ return ["", "I", "II", "III", "IV", "V", "VI"][n] || n; }

/* ── ZZZ: широкая карточка в духе Enka ── */
// порядок нижней сводки: HP%, HP, сила атаки %, сила атаки, защита %, защита, крит. шанс, крит. урон, знание аномалии, пробивание
const ZX_BAR = ["11102", "11103", "12102", "12103", "13102", "13103", "20103", "21103", "31203", "23203"];
function zxBarPos(k){ const i = ZX_BAR.indexOf(String(k)); return i === -1 ? 99 : i; }
// оценка сборки ZZZ: полезные усиления сабстатов (начальные + прокачка) из максимума для этого агента:
// 6 дисков × (сколько полезных сабстатов может стоять на диске, не больше 4, + 5 усилений).
// У дамагера с крит. шансом, крит. уроном и силой атаки % — 6 × (3 + 5) = 48, у аномалии
// (сила атаки %, знание аномалии) — 6 × (2 + 5) = 42. Плоские атака/HP/защита считаются за треть.
const ZX_FLAT = { "12103":"12102", "11103":"11102", "13103":"13102" };
function zxGrade(vm){
  const val = vm.valuable || {};
  let n = 0;
  vm.slots.forEach(d => (d.subs || []).forEach(s => {
    const k = String(s.key), r = (s.up || 0) + 1;
    if(val[k]) n += r; else if(ZX_FLAT[k] && val[ZX_FLAT[k]]) n += r / 3;
  }));
  n = Math.round(n * 10) / 10;
  const k = Math.min(4, Object.keys(val).filter(x => val[x]).length);
  const max = k ? 6 * (k + 5) : 48;
  const p = n / max;
  return { n, max, g: p >= .7 ? "SS" : p >= .56 ? "S" : p >= .42 ? "A" : p >= .28 ? "B" : "C" };
}
function zxCard(vm, uid, nick){
  const half = 6;   // первый столбец — от HP до крит. урона, остальное во втором
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
  const o = zxOpt(), gr = zxGrade(vm);
  const bgWord = { fire:"FIRE", ice:"ICE", electric:"ELECTRIC", physical:"PHYSICAL", ether:"ETHER", wind:"WIND", lumen:"LUMEN", frost:"FROST", auric:"AURIC", honed:"HONED" }[vm.elIc] || "ZZZ";
  let h = '<div class="zx r' + (vm.rank || "S") + (o.uid ? "" : " no-uid") + (o.nick ? "" : " no-nick") + (o.bar ? "" : " no-bar") + (o.rolls ? "" : " no-rolls") + (o.grade ? "" : " no-grade") + '" style="--accent:' + esc(vm.color) + '">' +
    '<div class="zx-main"><div class="zx-art"><div class="zx-bgw">' + bgWord + '</div>' + (vm.art ? '<img class="pre" alt="" referrerpolicy="no-referrer" src="' + esc(scImg(vm.art)) + '" onerror="this.remove()">' : "") +
      '<div class="zx-uid">' + esc(uid || "") + '</div>' +
      '<div class="zx-id"><div class="zx-lv">Уровень <b>' + vm.lvl + '</b> / ' + vm.maxLvl + '</div><div class="zx-nm">' + esc(vm.name) + '</div></div></div>' +
    '<div class="zx-mind"><div class="zx-mind-in">' + mind + '</div></div>' +
    '<div class="zx-mid"><div class="zx-mid-in"><div class="zx-stats"><div>' + col(vm.stats.slice(0, half)) + '</div><div>' + col(vm.stats.slice(half)) + '</div></div>' +
      '<div class="zx-low"><div class="zx-core">' + "abcdef".split("").map((l, i) => '<i class="' + (i < coreN ? "on" : "") + '" title="' + l.toUpperCase() + '"><span style="-webkit-mask-image:url(icons/zzz/core_' + l + '.svg);mask-image:url(icons/zzz/core_' + l + '.svg)"></span></i>').join("") + '</div>' +
        (vm.weapon ? '<div class="zx-w w' + esc(vm.weapon.badge || "B") + '"><div class="zx-wn">' + esc(vm.weapon.name) + '</div><div class="zx-wst">' + vm.weapon.stats.map(s => '<span' + (s[3] ? ' data-f="' + esc(s[3]) + '"' : "") + '>' + (s[2] ? ic(s[2]) : "") + esc(s[1]) + "</span>").join("") + '</div>' +
          xImg(vm.weapon.img, "zx-wimg") + '<em class="zx-p">' + vm.weapon.refine.label + vm.weapon.refine.n + '</em><em class="zx-wl">Lv. ' + vm.weapon.lvl + '</em></div>' : "") + '</div>' +
      '<div class="zx-low2"><div class="zx-skills">' + skills.map(s => '<span title="' + esc(s[0]) + '">' + zImg("sk_" + ZZZ_SKILL_IC[s[2]], "zx-skimg") + '<b>' + s[1] + "</b></span>").join("") + '</div>' +
        '<div class="zx-sets">' + vm.sets.map(s => '<div><span>' + esc(s.name) + '</span>' + xImg(s.icon, "zx-sicon") + '<b>' + (s.full ? "4/4" : "2/4") + "</b></div>").join("") + '</div></div>' +
    '</div></div>' +
    '<div class="zx-discs">' + vm.slots.map(d => d.empty ? '<div class="zx-d none"><div class="zx-box"><div class="zx-vin"></div><div class="zx-sq"><div class="zx-sqi"><b>' + d.pos + '</b></div></div></div><p>Пусто</p></div>' :
      '<div class="zx-d r' + (d.rank || "B") + '"><div class="zx-box"><div class="zx-vin">' + xImg(d.icon, "zx-dicon") + '</div>' +
        '<div class="zx-sq">' +
          '<div class="zx-sqi"><div class="zx-sq1"' + (d.main ? ' data-f="' + esc(d.main[3]) + '"' : "") + '><b>' + (d.main ? esc(d.main[1]) : "") + '</b>' + (d.main ? ic(d.main[2]) : "") + '</div>' +
          '<div class="zx-sq2"><em>Lv. ' + d.lvl + '</em><s>' + esc(d.rank || "B") + '</s></div></div></div></div>' +
        '<div class="zx-ds">' + d.subs.map(s => '<span class="' + (s.val ? "val" : "") + '" data-f="' + esc(String(s.key).slice(0, 3)) + '">' + ic(s.ic) + '<b>' + esc(s.v) + '</b>' + (s.up ? '<u style="width:' + (s.up * 8 - 2) + 'px"></u>' : "") + "</span>").join("") + "</div></div>").join("") + '</div>' +
    '</div><div class="zx-bar"><div class="zx-who">' +
      '<span class="zx-grade g' + gr.g + '" title="Оценка сборки: ' + gr.n.toLocaleString("ru-RU") + ' полезных усилений из ' + gr.max + ' возможных для этого агента"><b>' + gr.g + '</b><small>' + gr.n.toLocaleString("ru-RU") + ' / ' + gr.max + '</small></span>' +
      (nick ? '<span class="zx-nick">' + esc(nick) + '</span>' : "") + '</div><div class="zx-sum">' + Object.keys(sum).sort((a, b) => zxBarPos(a) - zxBarPos(b)).map(k => '<span' + (sum[k].val ? ' class="val"' : "") + ' title="' + esc(sum[k].name) + '" data-f="' + esc(String(k).slice(0, 3)) + '"><small>' + sum[k].n + '</small>' + ic(sum[k].ic) + '<b>' + esc(sum[k].fmt(sum[k].v)) + "</b></span>").join("") + '</div></div>' +
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
const SC_ALT_DEFAULT = { hkrpg:1, hk4e:1 };
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
  const u = enkaData[game + ":" + uid] || {};
  card.innerHTML = (game === "hk4e" ? gxCard(vm) : game === "hkrpg" ? hxCard(vm) : zxCard(vm, uid, u.nick || "")) + scOptsHtml(game);
  artEdit = false;
}
// ZZZ: что показывать на карточке (и на картинке из неё)
function zxOpt(){ return Object.assign({ uid:true, nick:true, bar:true, rolls:true, grade:true }, ui.zxOpt || {}); }
// строка под карточкой: что показывать (ZZZ) и подгонка портрета (все игры)
function scOptsHtml(game){
  const o = zxOpt();
  const chip = (k, t) => '<button class="chip' + (o[k] ? " on" : "") + '" data-zo="' + k + '" aria-pressed="' + o[k] + '">' + t + "</button>";
  const any = Object.keys(ui.artAdj || {}).length;
  return '<div class="chips sc-opts">' +
    (game === "nap" ? chip("uid", "UID") + chip("nick", "Ник") + chip("bar", "Сводка сабстатов") + chip("rolls", "Отметки усилений") + chip("grade", "Оценка") + '<i class="sc-opts-sep"></i>' : "") +
    '<button class="chip" id="scArt" title="Подвинуть и увеличить портрет персонажа">Портрет</button>' +
    '<button class="chip" id="scArtExport"' + (any ? "" : " hidden") + ' title="Скопировать ручные правки портретов">Экспорт портретов</button></div>';
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-zo]");
  if(!b) return;
  const k = b.dataset.zo, on = !zxOpt()[k];
  ui.zxOpt = Object.assign(zxOpt(), { [k]: on }); saveUI();
  b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
  const z = document.querySelector("#scCard .zx");
  if(z) z.classList.toggle("no-" + k, !on);
});


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
  clone.querySelectorAll(".art-tools").forEach(x => x.remove());
  clone.querySelectorAll(".art-edit").forEach(x => x.classList.remove("art-edit"));
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
    for(const u of urls){ if(/^data:/.test(u)) continue; const d = await scToDataUrl(new URL(u, location.href).href); if(d) out = out.split(u).join(d); }
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

document.getElementById("scCopy").addEventListener("click", async e => {
  const btn = e.currentTarget, node = document.querySelector("#scCard > *");
  if(!node || btn.disabled) return;
  const t = btn.textContent, note = document.getElementById("scNote");
  btn.disabled = true; btn.textContent = "Рисую…";
  let lost = 0;
  // ClipboardItem получает обещание сразу, внутри клика — так требует Safari
  const blobP = scCardPng(node).then(r => { lost = r.lost; if(!r.blob) throw new Error("png"); return r.blob; });
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blobP })]);
    btn.textContent = "Скопировано";
    if(lost) note.textContent = "Скопировано, но " + lost + " изображений Enka не отдал для рисования — на картинке их нет.";
    setTimeout(() => { btn.textContent = t; }, 1500);
  } catch(err){ console.error(err); note.textContent = "Браузер не дал скопировать картинку — сохраните её кнопкой «Картинкой»."; btn.textContent = t; }
  finally { btn.disabled = false; }
});

/* ── портрет в карточке: подгонка по рамке фигуры (items/data/art_focus.json) и ручная правка ──
   art_focus — рамка непрозрачной части арта и центр головы, считается раз в неделю на GitHub.
   Ручная правка (сдвиг и увеличение) хранится у пользователя, общая — в items/data/art_adj.json. */
let ART = null, ARTADJ = {}, artLoading = false, artCur = null, artEdit = false;
function artLoad(cb){
  if(ART){ cb && cb(); return; }
  if(artLoading) return;
  artLoading = true;
  Promise.all(["art_focus", "art_adj"].map(n => fetch("items/data/" + n + ".json", { cache:"no-cache" }).then(r => r.ok ? r.json() : {}).catch(() => ({}))))
    .then(([a, b]) => { ART = a || {}; ARTADJ = b || {}; artLoading = false; cb && cb(); });
}
function artKey(){ return artCur ? artCur.game + ":" + artCur.id : ""; }
function artAdjGet(){ const k = artKey(); return (ui.artAdj || {})[k] || ARTADJ[k] || null; }
function artBox(){ const c = document.getElementById("scCard"); return c && c.querySelector(".zx-art,.hx-art,.gx-art"); }
function artFit(){
  const box = artBox();
  if(!box || !artCur) return;
  // страховка: если подогнать не вышло (картинка не загрузилась и т.п.), арт всё равно появится
  clearTimeout(artFit.t); artFit.t = setTimeout(() => box.querySelectorAll("img.pre").forEach(i => i.classList.add("fit")), 2500);
  if(artEdit) artToolbar(box);
  const img = box.querySelector(":scope > img");
  if(!img) return;
  if(!img.complete || !img.naturalWidth){ img.addEventListener("load", artFit, { once:true }); return; }
  if(!ART){ artLoad(artFit); return; }
  const f = (ART[artCur.game] || {})[artCur.id], adj = artAdjGet();
  const W = box.clientWidth, H = box.clientHeight, iw = img.naturalWidth, ih = img.naturalHeight;
  if(!W || !H){ img.classList.add("fit"); return; }
  const hide = box.classList.contains("zx-art") ? 56 : 0;   // правый край арта ZZZ спрятан под столбцом кинограммы
  const cx = (W - hide) / 2, cy = H * 0.03;
  let s, left, top;
  // ручная правка задаёт место сама (от обычного заполнения), автоподгонка — только если правки нет
  if(f && f.length === 5 && !adj){
    const [l, t, r, b, hx] = f.map(v => v / 1000);
    // фигура по высоте занимает почти всю карточку, голова — по центру видимой части
    s = Math.min(0.95 * H / (Math.max(0.05, b - t) * ih), Math.max(W / iw, H / ih) * 2.5);
    left = cx - hx * iw * s; top = cy - t * ih * s;
  } else if(adj){
    // арт с фоном: обычное заполнение, к нему — ручная правка
    s = Math.max(W / iw, H / ih) * (box.classList.contains("hx-art") ? 1.14 : 1);
    left = (W - iw * s) / 2; top = -(ih * s - H) * 0.12;
  } else { img.classList.remove("fx"); img.removeAttribute("style"); img.classList.add("fit"); return; }
  if(adj){
    const z = adj.z || 1;
    left = cx + (left - cx) * z; top = cy + (top - cy) * z; s *= z;
    left += (adj.dx || 0) * W; top += (adj.dy || 0) * H;
  }
  img.classList.add("fx");
  img.style.cssText = "left:" + left.toFixed(1) + "px;top:" + top.toFixed(1) + "px;width:" + (iw * s).toFixed(1) + "px";
  img.classList.add("fit");   // показываем арт только когда он уже на своём месте — без прыжка
}
let artRT = 0;
window.addEventListener("resize", () => { clearTimeout(artRT); artRT = setTimeout(artFit, 150); });

// ручная подгонка: тянуть мышкой/пальцем, колесо или кнопки — размер
function artSet(fn){
  const k = artKey(); if(!k) return;
  ui.artAdj = ui.artAdj || {};
  const a = Object.assign({ dx:0, dy:0, z:1 }, artAdjGet() || {});
  fn(a);
  a.z = Math.min(3, Math.max(0.4, a.z));
  a.dx = Math.round(a.dx * 1000) / 1000; a.dy = Math.round(a.dy * 1000) / 1000; a.z = Math.round(a.z * 1000) / 1000;
  ui.artAdj[k] = a; saveUI(); artFit();
  const ex = document.getElementById("scArtExport"); if(ex) ex.hidden = false;
}
function artToolbar(box){
  box.classList.add("art-edit");
  if(box.querySelector(".art-tools")) return;
  const t = document.createElement("div");
  t.className = "art-tools";
  t.innerHTML = '<div><button data-a="out" title="Меньше">−</button><button data-a="in" title="Больше">+</button>' +
    '<button data-a="reset" title="Вернуть как было">↺</button><button data-a="done" class="on" title="Готово">✓</button></div>' +
    '<small>Тяните арт, колесо — размер</small>';
  t.addEventListener("pointerdown", e => e.stopPropagation());
  t.addEventListener("click", e => {
    const a = e.target.closest("button"); if(!a) return;
    if(a.dataset.a === "in") artSet(x => { x.z *= 1.06; });
    if(a.dataset.a === "out") artSet(x => { x.z /= 1.06; });
    if(a.dataset.a === "reset"){ if(ui.artAdj) delete ui.artAdj[artKey()]; saveUI(); artFit(); }
    if(a.dataset.a === "done") artEditToggle(false);
  });
  box.appendChild(t);
  box.addEventListener("pointerdown", e => {
    if(!artEdit) return;
    e.preventDefault();
    const W = box.clientWidth, H = box.clientHeight;
    let x0 = e.clientX, y0 = e.clientY;
    const mv = ev => { const dx = (ev.clientX - x0) / W, dy = (ev.clientY - y0) / H; x0 = ev.clientX; y0 = ev.clientY; artSet(a => { a.dx += dx; a.dy += dy; }); };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  });
  box.addEventListener("wheel", e => { if(!artEdit) return; e.preventDefault(); artSet(a => { a.z *= Math.exp(-e.deltaY * 0.0012); }); }, { passive:false });
}
function artEditToggle(on){
  artEdit = on;
  const pb = document.getElementById("scArt"); if(pb) pb.classList.toggle("on", on);
  const box = artBox();
  if(!box) return;
  if(on) artToolbar(box);
  else { box.classList.remove("art-edit"); const t = box.querySelector(".art-tools"); if(t) t.remove(); }
}
document.addEventListener("click", e => { if(e.target.closest && e.target.closest("#scArt")) artEditToggle(!artEdit); });
// экспорт ручных правок — прислать, чтобы внести в общий список
document.addEventListener("click", async e => {
  if(!(e.target.closest && e.target.closest("#scArtExport"))) return;
  const text = JSON.stringify(ui.artAdj || {}, null, 1);
  const note = document.getElementById("scNote");
  if(!Object.keys(ui.artAdj || {}).length){ note.textContent = "Ручных правок портретов пока нет."; return; }
  const btn = e.target.closest("#scArtExport");
  try {
    await navigator.clipboard.writeText(text);
    note.textContent = "Правки портретов скопированы — пришлите их, чтобы они стали общими.";
    btn.textContent = "Скопировано"; btn.classList.add("on");
    setTimeout(() => { btn.textContent = "Экспорт портретов"; btn.classList.remove("on"); }, 1800);
  }
  catch(e){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type:"application/json" })); a.download = "art_adj.json";
    document.body.appendChild(a); a.click(); a.remove();
    note.textContent = "Правки портретов сохранены файлом art_adj.json — пришлите его, чтобы они стали общими.";
  }
});

/* длинные имена: уменьшаем шрифт, пока имя не влезет в отведённые строки */
function scFitText(){
  document.querySelectorAll("#scCard .hx-name, #scCard .zx-nm").forEach(el => {
    el.style.fontSize = ""; el.style.overflowWrap = "";
    const lines = 2, min = 14;
    let fs = parseFloat(getComputedStyle(el).fontSize);
    const fits = () => {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || fs * 1.15;
      return el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height <= lh * lines + 2;
    };
    let guard = 30;
    while(!fits() && fs > min && guard--){ fs -= 1; el.style.fontSize = fs + "px"; }
    if(!fits()) el.style.overflowWrap = "anywhere";   // совсем длинное слово — переносим по буквам
  });
}
window.addEventListener("resize", () => { clearTimeout(scFitText.t); scFitText.t = setTimeout(scFitText, 150); });
