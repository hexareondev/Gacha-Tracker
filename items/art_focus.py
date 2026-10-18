#!/usr/bin/env python3
"""Где на арте стоит персонаж — для витрины.

Для каждого персонажа из items/data/*_build.json скачивает его арт с Enka и по
прозрачности находит рамку фигуры (слева, сверху, справа, снизу) и центр головы
по горизонтали. Витрина по этим числам ставит персонажа в центр и подбирает
увеличение, чтобы фигура входила по высоте.

Результат — items/data/art_focus.json:
  { "nap": { "1011": [l, t, r, b, hx], ... }, "hkrpg": {...}, "hk4e": {...} }
все числа — доли размера арта, умноженные на 1000. Непрозрачные арты (с фоном)
помечаются пустым списком — их витрина показывает как раньше.

Уже посчитанные арты повторно не скачиваются (флаг --all пересчитывает всё).
Нужен Pillow: pip install pillow
"""
import argparse, io, json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
HOST = "https://enka.network"
GAMES = {"nap": "nap_build.json", "hkrpg": "hkrpg_build.json", "hk4e": "hk4e_build.json"}


def focus(png_bytes):
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes))
    if im.mode not in ("RGBA", "LA") and not (im.mode == "P" and "transparency" in im.info):
        return []                                   # нет прозрачности — арт с фоном
    a = im.convert("RGBA").getchannel("A")
    w, h = a.size
    # уменьшаем для скорости: точности в доли процента хватает
    k = max(1, max(w, h) // 400)
    a = a.resize((max(1, w // k), max(1, h // k)))
    w, h = a.size
    mask = a.point(lambda v: 255 if v > 24 else 0)
    box = mask.getbbox()
    if not box:
        return []
    l, t, r, b = box
    if l <= 1 and t <= 1 and r >= w - 1 and b >= h - 1:
        return []                                   # фигура во весь кадр — по сути фон
    # центр головы: средний столбец непрозрачных точек в верхней трети фигуры
    px = mask.load()
    top_end = t + max(1, int((b - t) * 0.22))
    sx = n = 0
    for y in range(t, min(top_end, h)):
        for x in range(l, r):
            if px[x, y]:
                sx += x; n += 1
    hx = sx / n if n else (l + r) / 2
    f = lambda v, s: round(v / s * 1000)
    return [f(l, w), f(t, h), f(r, w), f(b, h), f(hx, w)]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "gacha-tracker-art-focus"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--all", action="store_true", help="пересчитать все арты заново")
    ap.add_argument("--host", default=HOST, help="откуда качать картинки")
    args = ap.parse_args()
    out_path = os.path.join(DATA, "art_focus.json")
    try:
        with open(out_path, encoding="utf-8") as f:
            out = json.load(f)
    except (OSError, ValueError):
        out = {}
    done = fail = 0
    for game, fn in GAMES.items():
        try:
            with open(os.path.join(DATA, fn), encoding="utf-8") as f:
                avatars = json.load(f).get("avatars", {})
        except (OSError, ValueError):
            continue
        cur = out.setdefault(game, {})
        for aid, av in avatars.items():
            img = av.get("img")
            if not img or (aid in cur and not args.all):
                continue
            try:
                cur[aid] = focus(fetch(args.host + img))
                done += 1
                time.sleep(0.1)
            except Exception as e:                  # одна картинка не должна ронять всё
                fail += 1
                print("  ! %s %s: %s" % (game, aid, e), file=sys.stderr)
    body = {g: dict(sorted(v.items())) for g, v in sorted(out.items())}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(body, f, ensure_ascii=False, separators=(",", ":"))
    print("арты: посчитано %d, не скачалось %d" % (done, fail))


if __name__ == "__main__":
    main()
