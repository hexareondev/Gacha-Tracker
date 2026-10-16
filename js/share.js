"use strict";
/* ── карточка удачи: PNG из истории круток, рисуется на canvas прямо в браузере ── */

const SHARE_W = 1080, SHARE_H = 1350;
let shareBlob = null;

// удача канала — то же, что в блоке «Удача» истории: первый топ канала не учитывается
function channelLuck(acc, b){
  const mname = (CHANNEL_MODEL[acc.game] || {})[b.k];
  if(!mname) return null;
  const tops = resolveTops(acc, b), done = tops.slice(1);
  if(done.length < 3) return null;
  const sum = done.reduce((s, x) => s + x.pulls, 0);
  const o = { b:b, n:done.length, avg:sum / done.length, exp:pityMean(mname), share:sumLuck(pityPmf(mname), done.length, sum) };
  const play = done.filter(x => x.st === "win" || x.st === "lose");
  if(play.length >= 3){
    o.play = play.length;
    o.win = play.filter(x => x.st === "win").length;
    o.p = mname === "char" ? .5 : .75;
    o.coin = coinLuck(o.play, o.win, o.p);
  }
  return o;
}

// какие баннеры попадают на карточку — выбор хранится отдельно для каждой игры
function shareOff(game){ return ((ui.shareOff || {})[game] || []).slice(); }
function shareData(acc){
  const g = gameInfo(acc.game);
  const off = shareOff(acc.game);
  const banners = accountBanners(acc).filter(b => off.indexOf(b.k) === -1);
  const total = banners.reduce((s, b) => s + b.total, 0);
  const tops = banners.reduce((s, b) => s + b.tops.length, 0);
  const times = banners.reduce((a, b) => a.concat([b.first, b.last]), []).filter(Boolean).sort();
  // главные каналы: ивентовый персонажей и оружейный — у них есть 50/50
  const main = banners.filter(b => b.info.pool === "limited" && (CHANNEL_MODEL[acc.game] || {})[b.k] && b.info.s !== "бангбу");
  const pick = kind => main.filter(b => (kind === "char") === (CHANNEL_MODEL[acc.game][b.k] === "char"))
    .sort((a, c) => c.tops.length - a.tops.length)[0];
  const luck = ["char", "weap"].map(k => { const b = pick(k); return b ? channelLuck(acc, b) : null; }).filter(Boolean);
  // последние ценные выпадения по всем каналам
  let recent = [];
  banners.forEach(b => {
    const seq = b.info.pool === "limited" ? resolveTops(acc, b) : b.tops.map(x => ({ rec:x.rec, pulls:x.pulls, st:"std" }));
    const m = PITY_MODEL[(CHANNEL_MODEL[acc.game] || {})[b.k]] || null;
    seq.forEach((x, i) => recent.push({ rec:x.rec, pulls:x.pulls, st:x.st, soft:m ? m.soft : b.info.pity * .82, first:i === 0 }));
  });
  recent.sort((a, c) => (c.rec.t || "").localeCompare(a.rec.t || "") || byId(c.rec, a.rec));
  recent = recent.slice(0, 10);
  return { acc:acc, g:g, total:total, tops:tops, avg: tops ? total / tops : 0,
    from: times[0] || "", to: times[times.length - 1] || "", luck:luck, recent:recent,
    word: acc.game === "nap" ? "S-ранг" : "5★", wordMany: acc.game === "nap" ? "S-рангов" : "5★" };
}

function loadShareImg(urls){
  return new Promise(res => {
    let i = 0, done = false;
    const img = new Image();
    img.crossOrigin = "anonymous";             // без CORS картинка не загрузится и не «испортит» холст
    img.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => { if(!done){ done = true; res(null); } }, 5000);
    img.onload = () => { if(!done){ done = true; clearTimeout(timer); res(img); } };
    img.onerror = () => {
      i++;
      if(i < urls.length) img.src = urls[i];
      else if(!done){ done = true; clearTimeout(timer); res(null); }
    };
    if(!urls.length){ done = true; clearTimeout(timer); res(null); return; }
    img.src = urls[0];
  });
}
function shareIconUrls(game, r){
  if(typeof iconList !== "function") return [];
  const list = iconList(game, r);
  const kind = iconKind(r), slot = game + ":" + kind;
  const ok = (ui.iconOk || {})[slot];
  const ordered = ok && list.indexOf(ok) >= 0 ? [ok].concat(list.filter(u => u !== ok)) : list;
  return ordered.slice(0, 4).map(t => t.replace(/\{id\}/g, r.i).replace(/\{game\}/g, game));
}

function rr(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fitText(ctx, t, maxW){
  if(ctx.measureText(t).width <= maxW) return t;
  while(t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
function dmyFull(t){ return t ? t.slice(0, 10).split("-").reverse().join(".") : ""; }

const SF = '"Space Grotesk","Segoe UI",system-ui,sans-serif', IF = '"Inter","Segoe UI",system-ui,sans-serif';
const C = { bg:"#0b0b10", panel:"#14141b", edge:"rgba(255,255,255,.08)", text:"#ece9f1", muted:"#9a97a6", dim:"#5e5c68",
  gold:"#f0c264", hot:"#ffdf95", crimson:"#e0576f", green:"#8fa86a", steel:"#8794a1" };

function drawShare(d, imgs, hideUid){
  const cv = document.createElement("canvas");
  cv.width = SHARE_W; cv.height = SHARE_H;
  const ctx = cv.getContext("2d");
  const P = 64;

  // фон
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  let gr = ctx.createRadialGradient(SHARE_W, 0, 0, SHARE_W, 0, 760);
  gr.addColorStop(0, "rgba(240,194,100,.22)"); gr.addColorStop(1, "rgba(240,194,100,0)");
  ctx.fillStyle = gr; ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  gr = ctx.createRadialGradient(0, SHARE_H, 0, 0, SHARE_H, 700);
  gr.addColorStop(0, "rgba(135,148,161,.12)"); gr.addColorStop(1, "rgba(135,148,161,0)");
  ctx.fillStyle = gr; ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  ctx.textBaseline = "alphabetic";

  // шапка
  ctx.fillStyle = C.gold; ctx.font = "600 24px " + IF;
  if("letterSpacing" in ctx) ctx.letterSpacing = "4px";
  ctx.fillText("ГАЧА ТРЕКЕР · УДАЧА", P, P + 22);
  if("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.fillStyle = C.text; ctx.font = "600 64px " + SF;
  ctx.fillText(fitText(ctx, d.g.name, SHARE_W - 2 * P), P, P + 100);
  ctx.fillStyle = C.muted; ctx.font = "400 26px " + IF;
  const sub = (hideUid ? "" : "UID " + d.acc.uid + "  ·  ") + (d.from ? "с " + dmyFull(d.from) + " по " + dmyFull(d.to) : "");
  ctx.fillText(fitText(ctx, sub, SHARE_W - 2 * P), P, P + 148);

  // итоги
  let y = 260;
  const bw = (SHARE_W - 2 * P - 2 * 16) / 3, bh = 150;
  const boxes = [
    ["Всего круток", d.total.toLocaleString("ru-RU"), C.hot],
    ["Выпало " + d.wordMany, String(d.tops), C.text],
    ["В среднем на один", d.tops ? fmtP(d.avg) : "—", C.text]
  ];
  boxes.forEach((bx, i) => {
    const x = P + i * (bw + 16);
    rr(ctx, x, y, bw, bh, 22);
    ctx.fillStyle = i === 0 ? "rgba(240,194,100,.08)" : C.panel; ctx.fill();
    ctx.strokeStyle = i === 0 ? "rgba(240,194,100,.28)" : C.edge; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = "500 23px " + IF;
    ctx.fillText(fitText(ctx, bx[0], bw - 48), x + 26, y + 46);
    ctx.fillStyle = bx[2]; ctx.font = "600 60px " + SF;
    ctx.fillText(bx[1], x + 26, y + 116);
  });

  // удача по главным каналам
  y += bh + 28;
  const lh = 300;
  if(d.luck.length){
    const n = d.luck.length, lw = (SHARE_W - 2 * P - (n - 1) * 16) / n;
    d.luck.forEach((l, i) => {
      const x = P + i * (lw + 16);
      rr(ctx, x, y, lw, lh, 22);
      ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.edge; ctx.lineWidth = 2; ctx.stroke();
      const good = l.share >= .5, col = good ? C.gold : C.crimson;
      ctx.fillStyle = C.muted; ctx.font = "500 23px " + IF;
      ctx.font = "400 20px " + IF; ctx.fillStyle = C.dim; ctx.textAlign = "right";
      const cnt = l.n + " шт.";
      ctx.fillText(cnt, x + lw - 26, y + 46);
      const cw0 = ctx.measureText(cnt).width;
      ctx.textAlign = "left"; ctx.fillStyle = C.muted; ctx.font = "500 23px " + IF;
      ctx.fillText(fitText(ctx, l.b.info.n, lw - 64 - cw0), x + 26, y + 46);
      ctx.fillStyle = col; ctx.font = "600 66px " + SF;
      const av = fmtP(l.avg);
      ctx.fillText(av, x + 26, y + 120);
      const aw = ctx.measureText(av).width;
      ctx.fillStyle = C.muted; ctx.font = "400 21px " + IF;
      const lines = n === 1 ? ["круток на один " + d.word + " · обычно " + fmtP(l.exp)]
        : ["круток на " + d.word, "обычно " + fmtP(l.exp)];
      lines.forEach((t, j) => ctx.fillText(fitText(ctx, t, lw - aw - 70), x + 26 + aw + 16, y + (lines.length > 1 ? 92 + j * 26 : 112)));
      // шкала: где вы среди игроков
      const gx = x + 26, gw = lw - 52, gy = y + 160;
      rr(ctx, gx, gy, gw, 10, 5); ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fill();
      const lg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
      lg.addColorStop(0, "rgba(224,87,111,.75)"); lg.addColorStop(.5, "rgba(135,148,161,.5)"); lg.addColorStop(1, "rgba(240,194,100,.85)");
      rr(ctx, gx, gy, gw, 10, 5); ctx.fillStyle = lg; ctx.fill();
      const mx = gx + gw * Math.max(.02, Math.min(.98, l.share));
      ctx.beginPath(); ctx.arc(mx, gy + 5, 13, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = col; ctx.font = "600 25px " + IF;
      ctx.fillText(fitText(ctx, luckWord(l.share).replace(/^./, c => c.toUpperCase()), lw - 52), x + 26, y + 220);
      ctx.fillStyle = C.muted; ctx.font = "400 21px " + IF;
      ctx.fillText(fitText(ctx, fiftyText(l), lw - 52), x + 26, y + 262);
    });
  } else {
    rr(ctx, P, y, SHARE_W - 2 * P, 120, 22);
    ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.edge; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = "400 24px " + IF;
    ctx.fillText("Для оценки удачи нужно хотя бы 4 выпадения " + d.wordMany + " в ивентовом канале.", P + 26, y + 68);
  }

  // последние выпадения
  y += (d.luck.length ? lh : 120) + 48;
  ctx.fillStyle = C.text; ctx.font = "600 30px " + SF;
  ctx.fillText("Последние " + (d.acc.game === "nap" ? "S-ранги" : "5★"), P, y);
  y += 26;
  const cols = 5, cw = (SHARE_W - 2 * P) / cols, ph = 108;
  d.recent.forEach((x, i) => {
    const cx = P + (i % cols) * cw + cw / 2, cy = y + Math.floor(i / cols) * 214 + ph / 2 + 6;
    const img = imgs[i];
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, ph / 2, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = "#1c1c24"; ctx.fill();
    ctx.clip();
    if(img){
      const s = Math.max(ph / img.width, ph / img.height);
      ctx.drawImage(img, cx - img.width * s / 2, cy - img.height * s / 2, img.width * s, img.height * s);
    } else {
      ctx.fillStyle = C.gold; ctx.font = "600 44px " + SF; ctx.textAlign = "center";
      ctx.fillText((x.rec.n || "?").charAt(0).toUpperCase(), cx, cy + 16);
    }
    ctx.restore();
    const ring = x.st === "lose" ? C.crimson : x.st === "std" ? C.steel : C.gold;
    ctx.beginPath(); ctx.arc(cx, cy, ph / 2, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = ring; ctx.stroke();
    // число круток — плашкой снизу портрета
    const t = x.first ? "≥" + x.pulls : String(x.pulls);
    ctx.font = "600 22px " + SF; ctx.textAlign = "center";
    const tw = ctx.measureText(t).width + 22;
    rr(ctx, cx - tw / 2, cy + ph / 2 - 16, tw, 32, 16);
    ctx.fillStyle = x.pulls >= x.soft ? C.crimson : x.pulls <= 40 ? C.gold : "#2a2a35"; ctx.fill();
    ctx.fillStyle = x.pulls <= 40 && x.pulls < x.soft ? "#1a1305" : "#fff";
    ctx.fillText(t, cx, cy + ph / 2 + 8);
    ctx.fillStyle = C.text; ctx.font = "500 21px " + IF;
    ctx.fillText(fitText(ctx, x.rec.n || "—", cw - 14), cx, cy + ph / 2 + 50);
    ctx.fillStyle = x.st === "lose" ? C.crimson : C.dim; ctx.font = "400 18px " + IF;
    ctx.fillText(fitText(ctx, recTag(x), cw - 14), cx, cy + ph / 2 + 76);
    ctx.textAlign = "left";
  });
  if(!d.recent.length){
    ctx.fillStyle = C.muted; ctx.font = "400 24px " + IF;
    ctx.fillText("Пока ни одного.", P, y + 40);
  }

  // подпись
  ctx.fillStyle = C.dim; ctx.font = "400 21px " + IF;
  ctx.fillText("hexareondev.github.io/Gacha-Tracker", P, SHARE_H - 52);
  ctx.textAlign = "right";
  ctx.fillText("модель гаранта — оценка сообщества", SHARE_W - P, SHARE_H - 52);
  ctx.textAlign = "left";
  return cv;
}

/* превью — обычная разметка, повторяющая картинку; PNG рисуется только по кнопке */
function pullTone(x){ return x.pulls >= x.soft ? "bad" : x.pulls <= 40 ? "good" : "mid"; }
function recTag(x){ return x.st === "lose" ? "проигрыш 50/50" : x.st === "win" ? "победа 50/50" : x.st === "guard" ? "гарант" : dmyFull(x.rec.t); }
function fiftyText(l){ return l.play ? "50/50: выиграно " + l.win + " из " + l.play + " (" + Math.round(l.win / l.play * 100) + "%)" : "50/50 не размечены"; }
let shareD = null;
function renderShareChips(acc){
  const box = document.getElementById("shareChans");
  const all = accountBanners(acc), off = shareOff(acc.game);
  box.innerHTML = "";
  all.forEach(b => {
    const on = off.indexOf(b.k) === -1;
    const c = document.createElement("button");
    c.className = "chip" + (on ? " on" : "");
    c.textContent = b.info.n;
    c.title = b.info.s + " · " + b.total.toLocaleString("ru-RU") + " круток";
    c.setAttribute("aria-pressed", on);
    c.onclick = () => {
      let o = shareOff(acc.game);
      if(on){
        if(all.length - o.length <= 1) return;     // хотя бы один баннер должен остаться
        o.push(b.k);
      } else o = o.filter(k => k !== b.k);
      ui.shareOff = ui.shareOff || {};
      ui.shareOff[acc.game] = o;
      saveUI();
      renderSharePreview();
    };
    box.appendChild(c);
  });
}
function renderSharePreview(){
  const acc = HA();
  if(!acc) return;
  renderShareChips(acc);
  const d = shareD = shareData(acc);
  const hide = document.getElementById("shareHideUid").checked;
  let h = '<div class="sc-brand">ГАЧА ТРЕКЕР · УДАЧА</div>' +
    '<div class="sc-game">' + esc(d.g.name) + '</div>' +
    '<div class="sc-sub">' + (hide ? "" : "UID " + esc(d.acc.uid) + "&nbsp; · &nbsp;") + (d.from ? "с " + dmyFull(d.from) + " по " + dmyFull(d.to) : "") + '</div>' +
    '<div class="sc-stats">' +
      '<div class="sc-box hot"><div class="k">Всего круток</div><div class="v">' + d.total.toLocaleString("ru-RU") + '</div></div>' +
      '<div class="sc-box"><div class="k">Выпало ' + d.wordMany + '</div><div class="v">' + d.tops + '</div></div>' +
      '<div class="sc-box"><div class="k">В среднем на один</div><div class="v">' + (d.tops ? fmtP(d.avg) : "—") + '</div></div>' +
    '</div>';
  if(d.luck.length){
    h += '<div class="sc-luck">';
    d.luck.forEach(l => {
      const tone = l.share >= .5 ? "good" : "bad";
      h += '<div class="sc-box ' + tone + '"><div class="sc-lh"><span>' + esc(l.b.info.n) + '</span><em>' + l.n + ' шт.</em></div>' +
        '<div class="sc-avg"><b>' + fmtP(l.avg) + '</b><span>' + (d.luck.length === 1 ? "круток на один " + d.word + " · обычно " + fmtP(l.exp) : "круток на " + d.word + "<br>обычно " + fmtP(l.exp)) + '</span></div>' +
        '<div class="sc-gauge"><i style="left:' + (Math.max(.02, Math.min(.98, l.share)) * 100).toFixed(1) + '%"></i></div>' +
        '<div class="sc-word">' + luckWord(l.share).replace(/^./, c => c.toUpperCase()) + '</div>' +
        '<div class="sc-fifty">' + fiftyText(l) + '</div></div>';
    });
    h += '</div>';
  } else {
    h += '<div class="sc-box sc-none">Для оценки удачи нужно хотя бы 4 выпадения ' + d.wordMany + ' в ивентовом канале.</div>';
  }
  h += '<div class="sc-rh">Последние ' + (d.acc.game === "nap" ? "S-ранги" : "5★") + '</div><div class="sc-rec">';
  d.recent.forEach(x => {
    h += '<div class="sc-it ' + x.st + '"><div class="sc-pic"><span>' + esc((x.rec.n || "?").charAt(0).toUpperCase()) + '</span></div>' +
      '<div class="sc-n ' + pullTone(x) + '">' + (x.first ? "≥" : "") + x.pulls + '</div>' +
      '<div class="sc-nm">' + esc(x.rec.n || "—") + '</div><div class="sc-tg">' + recTag(x) + '</div></div>';
  });
  if(!d.recent.length) h += '<div class="sc-none">Пока ни одного.</div>';
  h += '</div><div class="sc-foot"><span>hexareondev.github.io/Gacha-Tracker</span><span>модель гаранта — оценка сообщества</span></div>';
  const card = document.getElementById("shareCard");
  card.innerHTML = h;
  if(iconMode() !== "off") card.querySelectorAll(".sc-pic").forEach((el, i) => attachIcon(el, acc.game, d.recent[i].rec));
  fitSharePreview();
  shareBlob = null; shareKey = "";
  document.getElementById("shareSend").classList.toggle("hidden", !(navigator.canShare && navigator.canShare({ files:[new File([""], "a.png", { type:"image/png" })] })));
  document.getElementById("shareCopy").classList.toggle("hidden", !(navigator.clipboard && window.ClipboardItem));
  document.getElementById("shareNote").textContent = d.luck.length
    ? "Удача — какая доля игроков получила " + d.wordMany + " медленнее вас при тех же шансах. Первый " + d.word + " каждого канала не учитывается."
    : "";
}
function fitSharePreview(){
  const box = document.getElementById("sharePre"), card = document.getElementById("shareCard");
  const k = box.clientWidth / SHARE_W;
  card.style.transform = "scale(" + k + ")";
  box.style.height = (SHARE_H * k) + "px";
}
window.addEventListener("resize", () => { if(document.getElementById("shareOverlay").classList.contains("on")) fitSharePreview(); });

// PNG — по требованию; пока данные и галочка те же, готовая картинка переиспользуется
let shareKey = "";
async function makeShareBlob(){
  const acc = HA();
  if(!acc || !shareD) return null;
  const hide = document.getElementById("shareHideUid").checked;
  const key = acc.key + ":" + acc.records.length + ":" + hide + ":" + shareOff(acc.game).join(",");
  if(shareBlob && shareKey === key) return shareBlob;
  const d = shareD;
  try { if(document.fonts && document.fonts.load) await Promise.all([document.fonts.load('600 60px "Space Grotesk"'), document.fonts.load('500 20px "Inter"'), document.fonts.load('600 20px "Inter"')]); } catch(e){}
  const imgs = iconMode() === "off" ? [] : await Promise.all(d.recent.map(x => loadShareImg(shareIconUrls(acc.game, x.rec))));
  let cv = drawShare(d, imgs, hide);
  let blob = await new Promise(res => { try { cv.toBlob(b => res(b), "image/png"); } catch(e){ res(null); } });
  if(!blob){                                    // холст «испорчен» чужой картинкой — рисуем без портретов
    cv = drawShare(d, [], hide);
    blob = await new Promise(res => cv.toBlob(b => res(b), "image/png"));
  }
  shareBlob = blob; shareKey = key;
  return blob;
}
async function shareBusy(btn, fn){
  const t = btn.textContent;
  btn.disabled = true; btn.textContent = "Рисую…";
  try { await fn(); } finally { btn.disabled = false; if(btn.textContent === "Рисую…") btn.textContent = t; }
}
function shareFile(){
  const acc = HA();
  const name = "gacha-luck-" + (acc ? acc.game + "-" + acc.uid : "card") + ".png";
  return new File([shareBlob], name, { type:"image/png" });
}

function openShare(){
  document.getElementById("shareOverlay").classList.add("on");
  document.getElementById("shareHideUid").checked = !!ui.shareHideUid;
  renderSharePreview();
}
function closeShare(){ document.getElementById("shareOverlay").classList.remove("on"); }

document.getElementById("shareLuck").onclick = openShare;
document.getElementById("shareClose").onclick = closeShare;
document.getElementById("shareOverlay").addEventListener("mousedown", e => { if(e.target.id === "shareOverlay") closeShare(); });
document.getElementById("shareHideUid").onchange = e => {
  ui.shareHideUid = e.target.checked; saveUI();
  const sub = document.querySelector("#shareCard .sc-sub");
  if(sub) renderSharePreview();
};
document.getElementById("shareSave").onclick = e => shareBusy(e.currentTarget, async () => {
  if(!await makeShareBlob()) return;
  const f = shareFile(), a = document.createElement("a");
  a.href = URL.createObjectURL(f); a.download = f.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
document.getElementById("shareSend").onclick = e => shareBusy(e.currentTarget, async () => {
  if(!await makeShareBlob()) return;
  await navigator.share({ files:[shareFile()], title:"Моя удача в гаче" }).catch(() => {});
});
document.getElementById("shareCopy").onclick = async e => {
  const b = e.currentTarget;
  try {
    // промис в ClipboardItem: Safari требует вызвать write сразу по нажатию
    await navigator.clipboard.write([new ClipboardItem({ "image/png": makeShareBlob() })]);
    b.textContent = "Скопировано";
  } catch(err){ b.textContent = "Не вышло"; }
  setTimeout(() => { b.textContent = "Копировать"; }, 1800);
};
document.addEventListener("keydown", e => {
  if(e.key === "Escape" && document.getElementById("shareOverlay").classList.contains("on")) closeShare();
});
