#!/usr/bin/env python3
"""
Экспорт истории круток Genshin Impact, Honkai: Star Rail и Zenless Zone Zero
(глобальные серверы, Windows) в один файл формата UIGF v4.2.

Использование:
    1. В каждой нужной игре откройте историю круток (меню молитв/прыжков/поисков → История).
    2. Запустите:  python gacha_export.py
       Можно выбрать игры:     python gacha_export.py --games genshin hsr
       Путь к папке игры:      python gacha_export.py --path genshin="D:/Games/Genshin Impact game"
       Готовая ссылка:         python gacha_export.py --url hsr="https://...authkey=..."
       Язык названий:          python gacha_export.py --lang ru-ru
Зависимостей нет, нужен только Python 3.8+.
"""

import argparse
import glob
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

APP_NAME = "gacha-uigf-exporter"
APP_VERSION = "1.0.0"
UIGF_VERSION = "v4.2"

PAGE_SIZE = 20  # больше API не отдаёт
MIN_INTERVAL = 0.12  # минимальный интервал между ЛЮБЫМИ двумя запросами (на все потоки)
MAX_INTERVAL = 2.0
PARALLEL_POOLS = 3  # сколько баннеров качать одновременно
_interval = MIN_INTERVAL
_next_slot = 0.0
_rate_lock = threading.Lock()
_throttle_warned = False


def _wait_slot():
    """Общий для всех потоков ограничитель частоты запросов."""
    global _next_slot
    with _rate_lock:
        now = time.monotonic()
        slot = max(now, _next_slot)
        _next_slot = slot + _interval
    if slot > now:
        time.sleep(slot - now)


def _on_throttled():
    global _interval, _throttle_warned
    with _rate_lock:
        _interval = min(MAX_INTERVAL, _interval * 1.6 + 0.1)
        warn = not _throttle_warned
        _throttle_warned = True
    if warn:
        log("  ⚠ сервер просит запрашивать реже — замедляюсь, это может занять пару минут")


def _on_ok():
    global _interval
    with _rate_lock:
        _interval = max(MIN_INTERVAL, _interval * 0.97)

UIGF_LANGS = {
    "de-de", "en-us", "es-es", "fr-fr", "id-id", "it-it", "ja-jp", "ko-kr",
    "pt-pt", "ru-ru", "th-th", "tr-tr", "vi-vn", "zh-cn", "zh-tw",
}
# языки, для которых у UIGF API есть словари name -> item_id
UIGF_DICT_LANG = {
    "zh-cn": "chs", "zh-tw": "cht", "de-de": "de", "en-us": "en", "es-es": "es",
    "fr-fr": "fr", "id-id": "id", "ja-jp": "jp", "ko-kr": "kr", "pt-pt": "pt",
    "ru-ru": "ru", "th-th": "th", "vi-vn": "vi",
}

DRIVE_RE = re.compile(r"[A-Za-z]:[\\/]")
LOCALLOW = os.path.join(os.path.expanduser("~"), "AppData", "LocalLow")

GAMES = {
    "genshin": {
        "title": "Genshin Impact",
        "uigf_key": "hk4e",
        "logs": [
            os.path.join(LOCALLOW, "miHoYo", "Genshin Impact", "output_log.txt"),
            os.path.join(LOCALLOW, "miHoYo", "Genshin Impact", "output_log.txt.last"),
        ],
        "data_names": ["GenshinImpact_Data", "YuanShen_Data"],
        "api": "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog",
        "game_biz": "hk4e_global",
        "type_param": "gacha_type",
        # 400 (второй баннер персонажа) приходит вместе с 301
        "pools": [("100", None), ("200", None), ("301", None), ("302", None), ("500", None)],
        "dict_game": "genshin",
    },
    "hsr": {
        "title": "Honkai: Star Rail",
        "uigf_key": "hkrpg",
        "logs": [
            os.path.join(LOCALLOW, "Cognosphere", "Star Rail", "Player.log"),
            os.path.join(LOCALLOW, "Cognosphere", "Star Rail", "Player-prev.log"),
        ],
        "data_names": ["StarRail_Data"],
        "api": "https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/getGachaLog",
        "api_ld": "https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/getLdGachaLog",
        "game_biz": "hkrpg_global",
        "type_param": "gacha_type",
        # (тип, использовать ли эндпоинт коллаб-баннеров)
        "pools": [("1", None), ("2", None), ("11", None), ("12", None), ("21", "ld"), ("22", "ld")],
        "dict_game": "starrail",
    },
    "zzz": {
        "title": "Zenless Zone Zero",
        "uigf_key": "nap",
        "logs": [
            os.path.join(LOCALLOW, "miHoYo", "ZenlessZoneZero", "Player.log"),
            os.path.join(LOCALLOW, "miHoYo", "ZenlessZoneZero", "Player-prev.log"),
        ],
        "data_names": ["ZenlessZoneZero_Data"],
        "api": "https://public-operation-nap-sg.hoyoverse.com/common/gacha_record/api/getGachaLog",
        "game_biz": "nap_global",
        "type_param": "real_gacha_type",
        # 102/103 — «повторный показ» агентов и W-Engine (с версии 2.5), их нет в стандарте UIGF v4.2
        "pools": [("1", None), ("2", None), ("3", None), ("5", None), ("102", None), ("103", None)],
        "dict_game": None,
    },
}

POOL_NAMES = {
    "genshin": {"100": "Новичковая", "200": "Стандартная", "301": "Персонажи", "302": "Оружие", "500": "Хроники"},
    "hsr": {"1": "Стандартный", "2": "Новичковый", "11": "Персонажи", "12": "Световые конусы",
            "21": "Коллаб: персонажи", "22": "Коллаб: конусы"},
    "zzz": {"1": "Стандартный", "2": "Эксклюзивный", "3": "W-Engine", "5": "Бангбу",
            "102": "Повторный показ: агенты", "103": "Повторный показ: W-Engine"},
}

OUTPUT_FIELDS = {
    "hk4e": ["uigf_gacha_type", "gacha_type", "item_id", "count", "time", "name", "item_type", "rank_type", "id"],
    "hkrpg": ["gacha_id", "gacha_type", "item_id", "count", "time", "name", "item_type", "rank_type", "id"],
    "nap": ["gacha_id", "gacha_type", "item_id", "count", "time", "name", "item_type", "rank_type", "id"],
}


class ApiError(Exception):
    def __init__(self, retcode, message):
        super().__init__(f"retcode={retcode}: {message}")
        self.retcode = retcode


_out_lock = threading.RLock()
_status_len = 0


def _clear_status():
    global _status_len
    if _status_len:
        print("\r" + " " * _status_len + "\r", end="", flush=True)
        _status_len = 0


def plural(n, one="запись", few="записи", many="записей"):
    n10, n100 = n % 10, n % 100
    word = one if n10 == 1 and n100 != 11 else few if 2 <= n10 <= 4 and not 12 <= n100 <= 14 else many
    return f"{n} {word}"


def log(msg=""):
    """Постоянная строка вывода."""
    with _out_lock:
        _clear_status()
        print(msg, flush=True)


def status(msg):
    """Временная строка «что сейчас делаю» — перезаписывается следующим статусом или логом."""
    global _status_len
    with _out_lock:
        line = "  " + msg
        pad = max(0, _status_len - len(line))
        print("\r" + line + " " * pad, end="", flush=True)
        _status_len = len(line)


# ---------------------------------------------------------------- поиск ссылки

_data_dirs_cache = {}


def find_data_dirs(game):
    """Папки *_Data игры, найденные в логах (самые свежие упоминания первыми)."""
    key = game["title"]
    if key not in _data_dirs_cache:
        _data_dirs_cache[key] = _find_data_dirs(game)
    return _data_dirs_cache[key]


def _find_data_dirs(game):
    found = []
    for log_path in game["logs"]:
        if not os.path.isfile(log_path):
            continue
        try:
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except OSError:
            continue
        for name in game["data_names"]:
            end = len(text)
            while True:
                i = text.rfind(name, 0, end)
                if i < 0:
                    break
                end = i
                line_start = max(text.rfind("\n", 0, i), text.rfind("\r", 0, i)) + 1
                m = DRIVE_RE.search(text[line_start:i + 1])
                if not m:
                    continue
                path = os.path.normpath(text[line_start + m.start():i + len(name)].replace("\\", "/"))
                if path in found:
                    continue
                if os.path.isdir(path):
                    found.append(path)
                    break  # самого свежего упоминания достаточно
    return found


def normalize_user_path(path, game):
    """Пользователь мог указать папку игры, а не *_Data — ищем *_Data внутри."""
    path = os.path.normpath(path)
    if os.path.isdir(os.path.join(path, "webCaches")):
        return [path]
    candidates = []
    for pattern in ("*_Data", os.path.join("*", "*_Data")):
        for d in glob.glob(os.path.join(path, pattern)):
            if os.path.isdir(os.path.join(d, "webCaches")):
                candidates.append(d)
    return candidates or [path]


def find_cache_files(data_dir):
    patterns = [
        os.path.join(data_dir, "webCaches", "*", "Cache", "Cache_Data", "data_2"),
        os.path.join(data_dir, "webCaches", "Cache", "Cache_Data", "data_2"),
    ]
    files = []
    for p in patterns:
        files.extend(glob.glob(p))
    return sorted(set(files), key=lambda f: os.path.getmtime(f), reverse=True)


def _read_shared_windows(path):
    """Открывает файл с FILE_SHARE_READ|WRITE|DELETE — так же, как его держит запущенная игра.
    Обычный open() в Python не даёт FILE_SHARE_DELETE, поэтому получает Permission denied."""
    import ctypes
    import msvcrt
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateFileW.restype = wintypes.HANDLE
    kernel32.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
                                     wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    GENERIC_READ, SHARE_ALL, OPEN_EXISTING = 0x80000000, 0x7, 3
    handle = kernel32.CreateFileW(path, GENERIC_READ, SHARE_ALL, None, OPEN_EXISTING, 0, None)
    if handle in (None, ctypes.c_void_p(-1).value):
        raise ctypes.WinError(ctypes.get_last_error())
    fd = msvcrt.open_osfhandle(handle, os.O_RDONLY | os.O_BINARY)
    with os.fdopen(fd, "rb") as f:
        return f.read()


def _read_via_powershell(path):
    import subprocess
    tmp = os.path.join(tempfile.gettempdir(), "gacha_export_data_2")
    cmd = ["powershell", "-NoProfile", "-Command",
           "Copy-Item -LiteralPath $args[0] -Destination $args[1] -Force", path, tmp]
    subprocess.run(cmd, check=True, capture_output=True, timeout=60)
    try:
        with open(tmp, "rb") as f:
            return f.read()
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def read_locked_file(path):
    try:
        with open(path, "rb") as f:
            return f.read()
    except PermissionError as first_err:
        if os.name != "nt":
            raise
        for reader in (_read_shared_windows, _read_via_powershell):
            try:
                return reader(path)
            except Exception:
                continue
        raise PermissionError(f"{first_err}. Закройте игру и запустите скрипт ещё раз") from None


_URL_CHARS = re.compile(rb"[^\s\x00\"'<>\\]*")


def extract_urls(blob):
    """Линейный поиск: находим каждое 'authkey=' и расширяем до границ URL."""
    urls, pos = [], 0
    while True:
        idx = blob.find(b"authkey=", pos)
        if idx < 0:
            break
        pos = idx + 8
        start = blob.rfind(b"https://", max(0, idx - 4096), idx)
        if start < 0:
            continue
        head = blob[start:idx]
        if _URL_CHARS.fullmatch(head) is None or b"?" not in head:
            continue
        end = _URL_CHARS.match(blob, idx).end()
        u = blob[start:end].decode("utf-8", errors="ignore").split("#")[0]
        urls.append(u)
    result = []
    for u in reversed(urls):  # последние записи в кэше обычно самые свежие
        if u not in result:
            result.append(u)
    return result


def candidate_urls(game_key, game, user_path=None):
    status("ищу установленную игру…")
    dirs = normalize_user_path(user_path, game) if user_path else find_data_dirs(game)
    if not dirs:
        return [], "игра не найдена. Если она установлена, укажите путь: --path"
    urls = []
    for d in dirs:
        for cache in find_cache_files(d):
            status("ищу ссылку на историю в кэше игры…")
            try:
                found = extract_urls(read_locked_file(cache))
                urls.extend(u for u in found if u not in urls)
            except OSError as e:
                log(f"  ⚠ не удалось прочитать кэш игры: {e}")
            if urls:
                break
        if urls:
            break
    if not urls:
        return [], "ссылка на историю не найдена. Откройте историю круток в игре"
    return urls, None


# ---------------------------------------------------------------- API

def http_get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 " + APP_NAME})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def base_params(url, game, lang):
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query, keep_blank_values=True)
    params = {k: v[-1] for k, v in q.items()}
    for k in ("page", "size", "end_id", "gacha_type", "real_gacha_type", "begin_id"):
        params.pop(k, None)
    params.setdefault("authkey_ver", "1")
    params.setdefault("sign_type", "2")
    params["game_biz"] = game["game_biz"]
    params["lang"] = lang
    if game["type_param"] == "real_gacha_type":
        params.setdefault("init_log_gacha_base_type", "2")
    return params


def api_page(game, params, pool, ld, end_id):
    p = dict(params)
    p[game["type_param"]] = pool
    p["page"] = "1"
    p["size"] = str(PAGE_SIZE)
    p["end_id"] = end_id
    endpoint = game["api_ld"] if ld else game["api"]
    url = endpoint + "?" + urllib.parse.urlencode(p)
    net_fails = 0
    for attempt in range(30):
        _wait_slot()
        try:
            data = http_get_json(url)
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as e:
            net_fails += 1
            if net_fails >= 5:
                raise
            log(f"  ⚠ нет ответа от сервера ({e}), пробую снова…")
            time.sleep(2 * net_fails)
            continue
        rc = data.get("retcode")
        if rc == 0:
            _on_ok()
            return data.get("data") or {}
        if rc == -110:  # слишком часто
            _on_throttled()
            time.sleep(1.0)
            continue
        raise ApiError(rc, data.get("message"))
    raise ApiError(-110, "слишком много запросов, попробуйте позже")


def pick_working_params(game, urls, lang):
    first_pool, first_ld = game["pools"][0]
    last_err = None
    tried = set()
    status("проверяю доступ к истории…")
    for u in urls:
        params = base_params(u, game, lang)
        key = params.get("authkey")
        if not key or key in tried:
            continue  # в кэше десятки ссылок с одним и тем же ключом
        tried.add(key)
        if len(tried) > 5:
            break
        try:
            api_page(game, params, first_pool, first_ld, "0")
            return params, None
        except ApiError as e:
            last_err = e
            if e.retcode in (-100, -101, -1):  # недействительный / просроченный ключ
                continue
            return None, str(e)
    if last_err and last_err.retcode == -101:
        return None, "authkey просрочен. Откройте историю круток в игре заново"
    return None, f"не нашлось рабочей ссылки ({last_err})"


def fetch_pool(game_key, game, params, pool, ld, progress=None, known=frozenset()):
    """Качает баннер от новых круток к старым. Останавливается на первой записи из known —
    всё, что старше, уже есть в прошлой выгрузке."""
    records, end_id, seen = [], "0", set()
    meta = {}
    while True:
        data = api_page(game, params, pool, ld, end_id)
        for k in ("region_time_zone", "region"):
            if k in data:
                meta[k] = data[k]
        page = data.get("list") or []
        reached_known = False
        for i, r in enumerate(page):
            if r.get("id") in known:
                page, reached_known = page[:i], True
                break
        new = [r for r in page if r.get("id") not in seen]
        for r in new:
            seen.add(r["id"])
        records.extend(new)
        if progress:
            progress(len(records))
        if reached_known or not new or len(page) < PAGE_SIZE:
            break
        end_id = page[-1]["id"]
    return records, meta


# ---------------------------------------------------------------- item_id

_dict_cache = {}


def fill_item_ids(game, records, lang):
    missing = [r for r in records if not str(r.get("item_id") or "").strip()]
    if not missing:
        return 0
    if not game["dict_game"] or lang not in UIGF_DICT_LANG:
        return len(missing)
    status("определяю ID предметов…")
    key = (game["dict_game"], UIGF_DICT_LANG[lang])
    if key not in _dict_cache:
        url = f"https://api.uigf.org/dict/{key[0]}/{key[1]}.json"
        try:
            _dict_cache[key] = http_get_json(url)
        except Exception as e:
            log(f"  ⚠ словарь предметов не загрузился: {e}")
            _dict_cache[key] = {}
    d = _dict_cache[key]
    left = 0
    for r in missing:
        iid = d.get(r.get("name", ""))
        if iid:
            r["item_id"] = str(iid)
        else:
            left += 1
    return left


# ---------------------------------------------------------------- UIGF

def timezone_from_uid(game_key, uid):
    uid = str(uid)
    if game_key == "zzz":
        table = {"10": -5, "15": 1, "13": 8, "17": 8}
        return table.get(uid[:2], 8)
    if uid.startswith("18"):
        return 8
    return {"6": -5, "7": 1, "8": 8, "9": 8}.get(uid[:1], 8)


def to_uigf_record(game_key, uigf_key, r, pool):
    r = {k: ("" if v is None else str(v)) for k, v in r.items()}
    if game_key == "genshin":
        r["uigf_gacha_type"] = "301" if r.get("gacha_type") in ("301", "400") else r.get("gacha_type", pool)
    elif game_key == "zzz":
        r["gacha_type"] = pool  # API отдаёт внутренний тип (2001 и т.п.), UIGF ждёт 1/2/3/5
    r.setdefault("count", "1")
    return {k: r[k] for k in OUTPUT_FIELDS[uigf_key] if k in r}


def export_game(game_key, lang_pref, user_path=None, user_url=None, known=frozenset()):
    game = GAMES[game_key]
    log(f"\n{game['title']}")
    if user_url:
        urls = [user_url]
    else:
        urls, err = candidate_urls(game_key, game, user_path)
        if err:
            log(f"  ✗ пропуск: {err}")
            return None

    url_lang = urllib.parse.parse_qs(urllib.parse.urlparse(urls[0]).query).get("lang", [""])[-1].lower()
    if url_lang and url_lang not in UIGF_DICT_LANG:  # в ссылке бывает короткий код: "ru", "zh-cn", "ja"
        short = {"ja": "ja-jp", "ko": "ko-kr", "zh": "zh-cn"}.get(url_lang[:2])
        url_lang = short or next((k for k in UIGF_DICT_LANG if k.startswith(url_lang[:2] + "-")), url_lang)
    lang = lang_pref or url_lang
    if lang not in UIGF_DICT_LANG:  # нужен язык, для которого есть и enum UIGF, и словарь
        lang = "en-us"

    params, err = pick_working_params(game, urls, lang)
    if err:
        log(f"  ✗ пропуск: {err}")
        return None

    # баннеры грузятся параллельно; прогресс — одной общей строкой
    pools = game["pools"]
    counts = {pool: 0 for pool, _ in pools}
    lock = threading.Lock()

    def show():
        with lock:
            total = sum(counts.values())
        status(f"загружаю историю круток… {plural(total)}")

    def task(pool, ld):
        def progress(n):
            counts[pool] = n
            show()
        return fetch_pool(game_key, game, params, pool, ld, progress, known)

    if known:
        status("ищу новые крутки…")
    else:
        show()
    results = {}
    with ThreadPoolExecutor(max_workers=PARALLEL_POOLS) as ex:
        futures = {pool: ex.submit(task, pool, ld) for pool, ld in pools}
        for pool, fut in futures.items():
            try:
                results[pool] = fut.result()
            except Exception as e:
                results[pool] = e

    all_records, meta = {}, {}
    for pool, _ in pools:
        name = POOL_NAMES[game_key].get(pool, pool)
        res = results[pool]
        if isinstance(res, Exception):
            log(f"  ✗ {name}: ошибка — {res}")
            continue
        recs, m = res
        meta.update(m)
        for r in recs:
            all_records[r["id"]] = (r, pool)
        # пишем по каждому баннеру, даже если там 0 — иначе не видно, опрашивался ли он вообще
        log(f"  • {name}: {'+' if known else ''}{len(recs)}")

    if not all_records:
        if known:
            return []  # новых круток нет — останутся записи из прошлой выгрузки
        log("  ✗ за последние 6 месяцев круток нет")
        return None

    raw = [r for r, _ in all_records.values()]
    left = fill_item_ids(game, raw, lang)
    if left:
        log(f"  ⚠ у {left} записей не удалось определить item_id")

    by_uid = {}
    for r, pool in all_records.values():
        by_uid.setdefault(str(r.get("uid", "")), []).append(to_uigf_record(game_key, game["uigf_key"], r, pool))

    blocks = []
    for uid, lst in by_uid.items():
        lst.sort(key=lambda x: int(x["id"]))
        tz = meta.get("region_time_zone")
        tz = int(tz) if tz is not None and str(tz).lstrip("-").isdigit() else timezone_from_uid(game_key, uid)
        blocks.append({"uid": uid, "timezone": tz, "lang": lang, "list": lst})
    return blocks


# ---------------------------------------------------------------- прошлая выгрузка

# в собранном exe (PyInstaller) __file__ указывает во временную папку распаковки —
# настройки и прошлые выгрузки ищем рядом с самим exe
SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, "frozen", False) else __file__))
SETTINGS_FILE = os.path.join(SCRIPT_DIR, "gacha_export_settings.json")
DELTA_PREFIX = "uigf_new_"  # файлы «только новые крутки»

SAVE_MODES = {
    "append": "Дописывать в последний файл",
    "new_full": "Новый файл: вся история (старое + новое)",
    "new_only": "Новый файл: только новые крутки",
}
DEFAULT_SETTINGS = {"save_mode": "new_full"}


def load_settings():
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("save_mode") in SAVE_MODES:
            return {**DEFAULT_SETTINGS, **data}
    except (OSError, ValueError):
        pass
    return dict(DEFAULT_SETTINGS)


def save_settings(settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True
    except OSError as e:
        log(f"  ⚠ не удалось сохранить настройки: {e}")
        return False


def _export_files(include_delta):
    dirs = {os.getcwd(), SCRIPT_DIR}
    files = {os.path.abspath(f) for d in dirs for f in glob.glob(os.path.join(d, "uigf_*.json"))}
    if not include_delta:
        files = {f for f in files if not os.path.basename(f).startswith(DELTA_PREFIX)}
    return sorted(files, key=os.path.getmtime)


def find_previous_export(explicit=None):
    """Последняя ПОЛНАЯ выгрузка (файлы «только новые» не годятся как основа)."""
    if explicit:
        return explicit if os.path.isfile(explicit) else None
    files = _export_files(include_delta=False)
    return files[-1] if files else None


def known_ids_from_all_exports():
    """ID круток из всех выгрузок рядом (в т.ч. файлов «только новые») — по разделу игры."""
    known = {}
    for f in _export_files(include_delta=True):
        try:
            with open(f, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError):
            continue
        if not str(data.get("info", {}).get("version", "")).startswith("v4"):
            continue
        for k, blocks in data.items():
            if k == "info" or not isinstance(blocks, list):
                continue
            ids = known.setdefault(k, set())
            for b in blocks:
                ids.update(r.get("id") for r in b.get("list", []) if r.get("id"))
    return known


def write_json_atomic(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def load_previous_export(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as e:
        log(f"⚠ прошлую выгрузку не удалось прочитать ({e}), загружу всё заново")
        return None
    version = str(data.get("info", {}).get("version", ""))
    if not version.startswith("v4"):
        log(f"⚠ прошлая выгрузка в формате {version or '?'}, а не UIGF v4 — загружу всё заново")
        return None
    return data


def merge_blocks(old_blocks, new_blocks):
    """Объединяет записи по UID; при совпадении id побеждает свежая запись."""
    merged = {}
    for b in old_blocks or []:
        merged[str(b.get("uid"))] = {**b, "uid": str(b.get("uid")), "list": list(b.get("list", []))}
    added = {}
    for b in new_blocks:
        uid = str(b["uid"])
        base = merged.get(uid, {"list": []})
        by_id = {r["id"]: r for r in base["list"]}
        before = len(by_id)
        for r in b["list"]:
            by_id[r["id"]] = r
        added[uid] = len(by_id) - before
        merged[uid] = {**base, **{k: v for k, v in b.items() if k != "list"},
                       "list": sorted(by_id.values(), key=lambda x: int(x["id"]))}
    return list(merged.values()), added


def detect_games(paths, urls):
    """Игры, установленные на этом ПК (или для которых вручную задан путь/ссылка)."""
    status("ищу установленные игры…")
    found = [k for k, g in GAMES.items() if k in urls or k in paths or find_data_dirs(g)]
    with _out_lock:
        _clear_status()
    return found


def finish(code):
    if len(sys.argv) == 1 and os.name == "nt":  # запуск двойным кликом — не закрывать окно сразу
        try:
            input("\nНажмите Enter, чтобы закрыть…")
        except (EOFError, KeyboardInterrupt):
            pass
    sys.exit(code)


def ask(prompt):
    with _out_lock:
        _clear_status()
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        log("")
        return "0"


def settings_menu(settings):
    modes = list(SAVE_MODES)
    while True:
        log("\nНастройки — как сохранять результат:")
        for i, m in enumerate(modes, 1):
            mark = "   ← сейчас" if settings["save_mode"] == m else ""
            log(f"  {i} — {SAVE_MODES[m]}{mark}")
        log("  0 — Назад")
        raw = ask("Ваш выбор: ")
        if raw in ("", "0"):
            return
        if raw.isdigit() and 1 <= int(raw) <= len(modes):
            settings["save_mode"] = modes[int(raw) - 1]
            if save_settings(settings):
                log(f"  ✓ сохранено: {SAVE_MODES[settings['save_mode']]}")
            return
        log(f"  Не понял. Введите номер от 0 до {len(modes)}")


def choose_games(keys, settings):
    """Главное меню: выбор среди найденных игр и вход в настройки.
    Enter — все игры; можно выбрать несколько: «1 3» или «1,3»."""
    while True:
        result = _choose_games_once(keys, settings)
        if result == "settings":
            settings_menu(settings)
            continue
        return result


def _choose_games_once(keys, settings):
    many = len(keys) > 1
    all_num = len(keys) + 1 if many else None
    set_num = len(keys) + (2 if many else 1)
    default = all_num or 1
    log(f"\nРежим сохранения: {SAVE_MODES[settings['save_mode']]}")
    log("Выберите, откуда выгрузить крутки:")
    for i, k in enumerate(keys, 1):
        log(f"  {i} — {GAMES[k]['title']}")
    if many:
        log(f"  {all_num} — Все игры")
    log(f"  {set_num} — Настройки")
    log("  0 — Выход")
    while True:
        raw = ask(f"Ваш выбор [Enter = {default}]: ")
        if raw == str(set_num):
            return "settings"
        if raw == "" or (all_num and raw == str(all_num)):
            return list(keys) if many else [keys[0]]
        if raw == "0":
            return []
        parts = re.split(r"[\s,;]+", raw)
        if all(p.isdigit() and 1 <= int(p) <= len(keys) for p in parts):
            chosen = []
            for p in parts:
                k = keys[int(p) - 1]
                if k not in chosen:
                    chosen.append(k)
            return chosen
        log(f"  Не понял. Введите номер от 0 до {set_num}" + (", например 2 или 1 3" if many else ""))


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")

    ap = argparse.ArgumentParser(description="Экспорт истории круток в UIGF v4.2")
    ap.add_argument("--games", nargs="+", choices=list(GAMES),
                    help="какие игры выгрузить (без этого параметра покажется меню)")
    ap.add_argument("--path", action="append", default=[], metavar="GAME=DIR",
                    help="папка игры или *_Data, например genshin=\"D:/Games/Genshin Impact game\"")
    ap.add_argument("--url", action="append", default=[], metavar="GAME=URL",
                    help="готовая ссылка с authkey")
    ap.add_argument("--lang", choices=sorted(UIGF_DICT_LANG), help="язык названий (по умолчанию как в игре)")
    ap.add_argument("-o", "--out", help="имя выходного файла")
    ap.add_argument("--base", help="прошлая выгрузка, к которой дописывать (по умолчанию — самая свежая uigf_*.json рядом)")
    ap.add_argument("--full", action="store_true", help="не использовать прошлую выгрузку, скачать всё заново")
    ap.add_argument("--mode", choices=list(SAVE_MODES),
                    help="append — дописать в последний файл; new_full — новый файл со всей историей; "
                         "new_only — новый файл только с новыми крутками (по умолчанию — из настроек)")
    args = ap.parse_args()

    def kv(items):
        res = {}
        for it in items:
            k, _, v = it.partition("=")
            if k not in GAMES or not v:
                ap.error(f"неверный формат: {it}")
            res[k] = v.strip('"')
        return res

    paths, urls = kv(args.path), kv(args.url)
    settings = load_settings()
    log("Экспорт истории круток в UIGF v4.2")
    if not args.games:
        installed = detect_games(paths, urls)
        missing = [GAMES[k]["title"] for k in GAMES if k not in installed]
        if not installed:
            log("\nНе нашёл ни одной игры. Запустите нужную игру хотя бы раз и откройте историю круток,")
            log("либо укажите папку вручную: --path hsr=\"D:\\Games\\Star Rail\"")
            finish(1)
        if missing:
            log(f"Не найдены на этом ПК: {', '.join(missing)}")
        if sys.stdin and sys.stdin.isatty():
            args.games = choose_games(installed, settings)
        else:
            args.games = installed
        if not args.games:
            log("Выход.")
            sys.exit(0)

    mode = args.mode or settings["save_mode"]
    if args.mode or not (sys.stdin and sys.stdin.isatty()):
        log(f"Режим сохранения: {SAVE_MODES[mode]}")

    prev, prev_path = None, None
    all_known = known_ids_from_all_exports() if (mode == "new_only" and not args.full) else {}
    if not args.full:
        status("ищу прошлую выгрузку…")
        prev_path = find_previous_export(args.base)
        prev = load_previous_export(prev_path) if prev_path else None
        if args.base and not prev_path:
            log(f"⚠ файл {args.base} не найден — загружу всё заново")
    if prev:
        n = sum(len(b.get("list", [])) for k, v in prev.items() if k != "info" for b in v)
        log(f"Прошлая выгрузка: {os.path.basename(prev_path)} ({plural(n)}) — докачаю только новые крутки")
    elif all_known:
        log("Докачаю только крутки, которых нет в прошлых файлах")

    result = {
        "info": {
            "export_timestamp": int(time.time()),
            "export_app": APP_NAME,
            "export_app_version": APP_VERSION,
            "version": UIGF_VERSION,
        }
    }
    new_total = 0
    delta = {"info": dict(result["info"])}  # только новые записи — для режима new_only
    for g in args.games:
        key = GAMES[g]["uigf_key"]
        old_blocks = (prev or {}).get(key) or []
        known = frozenset(r["id"] for b in old_blocks for r in b.get("list", [])) | frozenset(all_known.get(key, ()))
        try:
            blocks = export_game(g, args.lang, paths.get(g), urls.get(g), known)
        except Exception as e:  # одна игра не должна ронять остальные
            log(f"  ✗ ошибка: {type(e).__name__}: {e}")
            blocks = None
        if blocks is None:
            if old_blocks:
                log("  • оставляю записи из прошлой выгрузки")
                result[key] = old_blocks
            continue
        fresh = []
        for b in blocks:
            lst = [r for r in b["list"] if r["id"] not in known]
            if lst:
                fresh.append({**b, "list": lst})
        if fresh:
            delta[key] = fresh
        merged, added = merge_blocks(old_blocks, blocks)
        result[key] = merged
        if not blocks:
            log("  ✓ новых круток нет")
        for b in merged:
            if b["uid"] in added:
                if mode == "new_only" and known:
                    log(f"  ✓ UID {b['uid']}: +{plural(added[b['uid']], 'новая запись', 'новые записи', 'новых записей')}")
                else:
                    extra = f" (+{added[b['uid']]} новых)" if known else ""
                    log(f"  ✓ UID {b['uid']}: {plural(len(b['list']))}{extra}")
                new_total += added[b["uid"]]

    # игры из прошлой выгрузки, которые в этот раз не выбирались, переносим как есть
    for k, v in (prev or {}).items():
        if k != "info" and k not in result:
            result[k] = v

    had_history = bool(prev or all_known)
    stamp = f"{datetime.now():%Y%m%d_%H%M%S}"
    if had_history and new_total == 0 and len(delta) == 1:
        if mode == "new_only" or not prev_path:
            log("\nНовых круток нет — файл не создаю.")
        else:
            log(f"\nНовых круток нет — {os.path.basename(prev_path)} уже актуален, файл не создаю.")
        code = 0
    elif len(result) == 1:
        log("\nНичего не выгружено. Откройте историю круток в игре и запустите снова.")
        code = 1
    else:
        status("сохраняю файл…")
        if mode == "append" and prev_path and not args.out:
            out, data, verb = prev_path, result, "Дописано в"
        elif mode == "new_only" and had_history:
            out, data, verb = args.out or f"{DELTA_PREFIX}{stamp}.json", delta, "Файл"
        else:
            out, data, verb = args.out or f"uigf_{stamp}.json", result, "Файл"
        write_json_atomic(out, data)
        total = sum(len(b["list"]) for k, v in data.items() if k != "info" for b in v)
        if data is delta:
            log(f"\nГотово: {plural(total, 'новая запись', 'новые записи', 'новых записей')}\n{verb}: {os.path.abspath(out)}")
        else:
            extra = f", из них новых: {new_total}" if had_history else ""
            log(f"\nГотово: {plural(total)}{extra}\n{verb}: {os.path.abspath(out)}")
        code = 0

    finish(code)


if __name__ == "__main__":
    main()
