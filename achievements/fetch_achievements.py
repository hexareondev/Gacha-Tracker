#!/usr/bin/env python3
"""
Сборщик базы достижений для Genshin Impact, Honkai: Star Rail и Zenless Zone Zero.

Скачивает полный список достижений каждой игры и сохраняет его в отдельный
JSON-файл единого формата:

    data/genshin_achievements.json
    data/hsr_achievements.json
    data/zzz_achievements.json

Источники:
  * основной — stardb.gg (все три игры, категории, награды, версии,
    скрытые и взаимоисключающие достижения);
  * запасной — paimon-moe (Genshin) и Mar-7th/StarRailRes (HSR) на GitHub.
    Для ZZZ запасного источника нет.

Только стандартная библиотека Python 3.8+.

Примеры:
    python fetch_achievements.py
    python fetch_achievements.py --lang en --out ./db
    python fetch_achievements.py --games zzz,hsr
    python fetch_achievements.py --source fallback
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "gacha-achievement-exporter/1.0 (+personal tracker)"
SCHEMA_VERSION = 1

GAMES = {
    "gi": {
        "title": "Genshin Impact",
        "file": "genshin_achievements.json",
        "currency": "primogem",
        "stardb": "https://stardb.gg/api/gi/achievements?lang={lang}",
    },
    "hsr": {
        "title": "Honkai: Star Rail",
        "file": "hsr_achievements.json",
        "currency": "stellar_jade",
        "stardb": "https://stardb.gg/api/achievements?lang={lang}",
    },
    "zzz": {
        "title": "Zenless Zone Zero",
        "file": "zzz_achievements.json",
        "currency": "polychrome",
        "stardb": "https://stardb.gg/api/zzz/achievements?lang={lang}",
    },
}

# Коды языков запасных источников отличаются от stardb.
PAIMON_LANGS = {"zh-cn": "zh", "zh-tw": "tw", "jp": "ja"}
STARRAILRES_LANGS = {"zh-cn": "cn", "zh-tw": "cht", "ja": "jp"}

PAIMON_URL = "https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/src/data/achievement/{lang}.json"
STARRAILRES_URL = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/{lang}/achievements.json"


# --------------------------------------------------------------------------
# Сеть
# --------------------------------------------------------------------------

def fetch_json(url: str, retries: int = 3, timeout: int = 60):
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_error = e
            if attempt < retries:
                time.sleep(2 * attempt)
    raise RuntimeError(f"не удалось загрузить {url}: {last_error}")


# --------------------------------------------------------------------------
# Парсеры источников -> список достижений единого вида
# --------------------------------------------------------------------------

def _int_or_none(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def parse_stardb(raw: list) -> tuple[list, list]:
    """stardb.gg: плоский массив; series/series_name в каждой записи."""
    achievements, series = [], {}
    for a in raw:
        sid = _int_or_none(a.get("series"))
        if sid not in series:
            series[sid] = {"id": sid, "name": a.get("series_name")}
        item = {
            "id": int(a["id"]),
            "series_id": sid,
            "name": a.get("name"),
            "description": a.get("description"),
            "reward": a.get("currency"),
            "hidden": bool(a.get("hidden", False)),
            "version": a.get("version"),
            # Достижения с одинаковым set взаимоисключающие: можно получить только одно.
            "set": a.get("set"),
            "gacha": bool(a.get("gacha", False)),
            "missable": bool(a.get("missable", False)),
            "impossible": bool(a.get("impossible", False)),
            "timegated": a.get("timegated"),
            "difficulty": a.get("difficulty"),
            "hint": a.get("comment"),
        }
        achievements.append(item)
    return achievements, list(series.values())


def parse_paimon(raw: dict) -> tuple[list, list]:
    """paimon-moe: {cat_id: {name, order, achievements: [item | [item, item...]]}}.
    Вложенный список — ступени одного достижения (1/30/100 и т.п.)."""
    achievements, series = [], []
    cats = sorted(raw.items(), key=lambda kv: kv[1].get("order", 0))
    for cat_id, cat in cats:
        sid = _int_or_none(cat_id)
        series.append({"id": sid, "name": cat.get("name")})
        for entry in cat.get("achievements", []):
            group = entry if isinstance(entry, list) else [entry]
            for stage, a in enumerate(group, 1):
                achievements.append({
                    "id": int(a["id"]),
                    "series_id": sid,
                    "name": a.get("name"),
                    "description": a.get("desc"),
                    "reward": a.get("reward"),
                    "hidden": False,
                    "version": a.get("ver"),
                    "set": None,
                    "stage": stage if len(group) > 1 else None,
                    "stages": len(group) if len(group) > 1 else None,
                })
    return achievements, series


def parse_starrailres(raw: dict) -> tuple[list, list]:
    """Mar-7th/StarRailRes: {id: {id, series_id, title, desc, hide}}.
    Названий серий и наград здесь нет — поля остаются пустыми."""
    achievements, series = [], {}
    for a in raw.values():
        sid = _int_or_none(a.get("series_id"))
        series.setdefault(sid, {"id": sid, "name": None})
        achievements.append({
            "id": int(a["id"]),
            "series_id": sid,
            "name": a.get("title"),
            "description": a.get("desc"),
            "reward": None,
            "hidden": bool(a.get("hide", False)),
            "version": None,
            "set": None,
        })
    achievements.sort(key=lambda x: (x["series_id"] or 0, x["id"]))
    return achievements, sorted(series.values(), key=lambda s: s["id"] or 0)


# --------------------------------------------------------------------------
# Сборка
# --------------------------------------------------------------------------

def load_game(game: str, lang: str, source: str):
    errors = []
    if source in ("auto", "stardb"):
        url = GAMES[game]["stardb"].format(lang=lang)
        try:
            ach, ser = parse_stardb(fetch_json(url))
            if ach:
                return ach, ser, "stardb.gg"
            errors.append("stardb.gg вернул пустой список")
        except Exception as e:  # noqa: BLE001
            errors.append(str(e))
        if source == "stardb":
            raise RuntimeError("; ".join(errors))

    if game == "gi":
        url = PAIMON_URL.format(lang=PAIMON_LANGS.get(lang, lang))
        ach, ser = parse_paimon(fetch_json(url))
        return ach, ser, "paimon-moe (GitHub)"
    if game == "hsr":
        url = STARRAILRES_URL.format(lang=STARRAILRES_LANGS.get(lang, lang))
        ach, ser = parse_starrailres(fetch_json(url))
        return ach, ser, "Mar-7th/StarRailRes (GitHub)"

    errors.append("для ZZZ запасного источника нет")
    raise RuntimeError("; ".join(errors))


def build_document(game: str, lang: str, achievements: list, series: list, source: str) -> dict:
    # Дедупликация по id (на всякий случай) с сохранением порядка.
    seen, uniq = set(), []
    for a in achievements:
        if a["id"] not in seen:
            seen.add(a["id"])
            uniq.append(a)

    counts = {}
    for a in uniq:
        counts[a["series_id"]] = counts.get(a["series_id"], 0) + 1
    for s in series:
        s["count"] = counts.get(s["id"], 0)
    series = [s for s in series if s["count"]]

    # Во взаимоисключающих наборах награду можно получить только за одно достижение.
    total_reward, counted_sets = 0, set()
    for a in uniq:
        r = a.get("reward") or 0
        if a.get("set") is not None:
            if a["set"] in counted_sets:
                continue
            counted_sets.add(a["set"])
        total_reward += r

    return {
        "schema_version": SCHEMA_VERSION,
        "game": game,
        "game_title": GAMES[game]["title"],
        "lang": lang,
        "source": source,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "currency": GAMES[game]["currency"],
        "total": len(uniq),
        "total_reward": total_reward if any(a.get("reward") for a in uniq) else None,
        "series": series,
        "achievements": [{k: v for k, v in a.items() if v is not None} for a in uniq],
    }


def is_unchanged(path: Path, doc: dict) -> bool:
    """Не перезаписывать файл, если поменялась только дата генерации."""
    if not path.exists():
        return False
    try:
        old = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    strip = lambda d: {k: v for k, v in d.items() if k != "generated_at"}  # noqa: E731
    return strip(old) == strip(doc)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Собирает базу достижений GI / HSR / ZZZ в JSON-файлы.")
    p.add_argument("--games", default="gi,hsr,zzz", help="через запятую: gi,hsr,zzz (по умолчанию все)")
    p.add_argument("--lang", default="ru", help="язык названий: ru, en, de, ja, ... (по умолчанию ru)")
    p.add_argument("--out", default="data", help="папка для файлов (по умолчанию ./data)")
    p.add_argument("--source", choices=["auto", "stardb", "fallback"], default="auto",
                   help="auto — stardb.gg с запасным источником; stardb — только он; fallback — только GitHub")
    p.add_argument("--indent", type=int, default=2, help="отступ JSON; 0 — компактный файл")
    args = p.parse_args(argv)

    games = [g.strip() for g in args.games.split(",") if g.strip()]
    unknown = [g for g in games if g not in GAMES]
    if unknown:
        p.error(f"неизвестные игры: {', '.join(unknown)}")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    failed = 0

    for game in games:
        title = GAMES[game]["title"]
        try:
            ach, ser, src = load_game(game, args.lang, args.source)
            doc = build_document(game, args.lang, ach, ser, src)
            path = out_dir / GAMES[game]["file"]
            reward = f", награда всего: {doc['total_reward']}" if doc["total_reward"] else ""
            summary = (f"{title}: {doc['total']} достижений в {len(doc['series'])} категориях"
                       f"{reward} — {src}")
            if is_unchanged(path, doc):
                print(f"[без изменений] {summary}")
                continue
            path.write_text(
                json.dumps(doc, ensure_ascii=False, indent=args.indent or None), encoding="utf-8"
            )
            print(f"[ok] {summary} -> {path}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"[ошибка] {title}: {e}", file=sys.stderr)

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
