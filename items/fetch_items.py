#!/usr/bin/env python3
"""
База персонажей и оружия для Гача Трекера: Genshin Impact, Honkai: Star Rail, Zenless Zone Zero.

Берёт открытые справочники EnkaNetwork (github.com/EnkaNetwork/API-docs, папка store)
и сохраняет по одному компактному файлу на игру: items/data/hk4e.json, hkrpg.json, nap.json.
Коды предметов совпадают с item_id в файлах истории UIGF.

    python items/fetch_items.py                 # скачать и собрать
    python items/fetch_items.py --store DIR     # собрать из локальной копии папки store

Зависимостей нет, нужен Python 3.8+.
"""

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

RAW = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/"
HERE = os.path.dirname(os.path.abspath(__file__))


def load(store, path):
    if store:
        with open(os.path.join(store, path), encoding="utf-8") as f:
            return json.load(f)
    req = urllib.request.Request(RAW + path, headers={"User-Agent": "gacha-tracker-items"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def name(locs, key):
    key = str(key)
    ru = (locs.get("ru") or {}).get(key) or ""
    en = (locs.get("en") or {}).get(key) or ""
    return ru or en, en or ru


def gi_icon(name):
    # в справочнике бывает и «UI_AvatarIcon_Side_X», и уже готовый путь «/ui/….png»
    if not name:
        return ""
    return name if name.startswith("/") else "/ui/" + name + ".png"


def genshin(store):
    locs = load(store, "gi/locs.json")
    out = {}
    for iid, a in load(store, "gi/avatars.json").items():
        if "-" in iid or iid in ("10000005", "10000007"):      # путешественник — не из молитв
            continue
        r = {"QUALITY_ORANGE": 5, "QUALITY_ORANGE_SP": 5, "QUALITY_PURPLE": 4}.get(a.get("QualityType"))
        if not r:
            continue
        ru, en = name(locs, a.get("NameTextMapHash"))
        if ru:
            out[iid] = {"n": ru, "en": en, "r": r, "t": "c", "i": gi_icon(a.get("SideIconName", ""))}
    for iid, w in load(store, "gi/weapons.json").items():
        if w.get("Rarity", 0) < 4:
            continue
        ru, en = name(locs, w.get("NameTextMapHash"))
        if ru:
            out[iid] = {"n": ru, "en": en, "r": w["Rarity"], "t": "w", "i": w.get("Icon", "")}
    return out


def starrail(store):
    locs = load(store, "hsr/hsr.json")
    out = {}
    for iid, a in load(store, "hsr/avatars.json").items():
        if int(iid) >= 8000 or a.get("Rarity", 0) < 4:         # 8001+ — Первопроходец
            continue
        ru, en = name(locs, (a.get("AvatarName") or {}).get("Hash"))
        if ru:
            out[iid] = {"n": ru, "en": en, "r": a["Rarity"], "t": "c", "i": a.get("AvatarSideIconPath", "")}
    for iid, w in load(store, "hsr/weapons.json").items():
        if w.get("Rarity", 0) < 4:
            continue
        ru, en = name(locs, (w.get("EquipmentName") or {}).get("Hash"))
        if ru:
            out[iid] = {"n": ru, "en": en, "r": w["Rarity"], "t": "w", "i": w.get("ImagePath", "")}
    return out


def zenless(store):
    locs = load(store, "zzz/locs.json")
    out = {}
    for iid, a in load(store, "zzz/avatars.json").items():
        if a.get("Rarity", 0) < 3:                              # 4 — S-ранг, 3 — A-ранг
            continue
        ru, en = name(locs, a.get("Name"))
        if ru:
            out[iid] = {"n": ru, "en": en, "r": a["Rarity"], "t": "c", "i": a.get("CircleIcon") or a.get("Image", "")}
    for iid, w in load(store, "zzz/weapons.json").items():
        if w.get("Rarity", 0) < 3:
            continue
        ru, en = name(locs, w.get("ItemName"))
        if ru:
            out[iid] = {"n": ru, "en": en, "r": w["Rarity"], "t": "w", "i": w.get("ImagePath", "")}
    return out


def main():
    ap = argparse.ArgumentParser(description="База персонажей и оружия из справочников EnkaNetwork")
    ap.add_argument("--store", help="локальная папка store из EnkaNetwork/API-docs")
    ap.add_argument("--out", default=os.path.join(HERE, "data"), help="куда сохранить (по умолчанию items/data)")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for game, fn in (("hk4e", genshin), ("hkrpg", starrail), ("nap", zenless)):
        try:
            items = fn(args.store)
        except Exception as e:                                  # одна игра не должна ломать остальные
            print(f"{game}: ошибка — {e}", file=sys.stderr)
            continue
        if len(items) < 20:
            print(f"{game}: подозрительно мало предметов ({len(items)}), файл не перезаписан", file=sys.stderr)
            continue
        path = os.path.join(args.out, game + ".json")
        body = {"game": game, "source": "EnkaNetwork/API-docs", "items": dict(sorted(items.items(), key=lambda kv: int(kv[0])))}
        try:
            with open(path, encoding="utf-8") as f:
                old = json.load(f)
            if old.get("items") == body["items"]:
                print(f"{game}: без изменений ({len(items)})")
                continue
        except (OSError, ValueError):
            pass
        body["updated"] = stamp
        with open(path, "w", encoding="utf-8") as f:
            json.dump(body, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        chars = sum(1 for v in items.values() if v["t"] == "c")
        print(f"{game}: персонажей {chars}, оружия {len(items) - chars} → {path}")


if __name__ == "__main__":
    main()
