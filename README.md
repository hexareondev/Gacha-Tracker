# База достижений GI / HSR / ZZZ

`fetch_achievements.py` скачивает полный список достижений трёх игр и сохраняет в три файла:

| Игра | Файл | Валюта награды |
|---|---|---|
| Genshin Impact | `data/genshin_achievements.json` | примогемы |
| Honkai: Star Rail | `data/hsr_achievements.json` | звёздный нефрит |
| Zenless Zone Zero | `data/zzz_achievements.json` | полихромы |

## Запуск

Нужен только Python 3.8+, без сторонних библиотек.

```
python fetch_achievements.py                 # все игры, на русском, в ./data
python fetch_achievements.py --games zzz     # одна игра
python fetch_achievements.py --lang en       # другой язык названий
python fetch_achievements.py --source fallback   # без stardb.gg (только GI и HSR)
```

Если база не изменилась, файл не перезаписывается.

## Источники

- **stardb.gg** — основной, для всех трёх игр: категории, награды, версии, скрытые и взаимоисключающие достижения, подсказки.
- **paimon-moe** (GI) и **Mar-7th/StarRailRes** (HSR) на GitHub — запасные, если stardb недоступен. В StarRailRes нет названий категорий и наград, эти поля будут пустыми. Для ZZZ запасного источника нет.

## Формат файла

```json
{
  "schema_version": 1,
  "game": "zzz",
  "game_title": "Zenless Zone Zero",
  "lang": "ru",
  "source": "stardb.gg",
  "generated_at": "2026-10-08T17:00:00Z",
  "currency": "polychrome",
  "total": 1234,
  "total_reward": 9999,
  "series": [ { "id": 1004, "name": "Доверие агентов", "count": 30 } ],
  "achievements": [
    {
      "id": 1004001,
      "series_id": 1004,
      "name": "…",
      "description": "…",
      "reward": 5,
      "hidden": false,
      "version": "1.0",
      "set": 7,
      "missable": false,
      "gacha": false,
      "impossible": false,
      "difficulty": "easy",
      "hint": "…"
    }
  ]
}
```

- `id` — внутриигровой ID достижения; по нему будут сопоставляться полученные достижения.
- `set` — достижения с одинаковым `set` взаимоисключающие: получить можно только одно. `total_reward` это учитывает.
- `stage` / `stages` — ступени многоуровневого достижения (только у запасного источника GI).
- Пустые поля в файл не пишутся.

## Автообновление на GitHub

`update-achievements.yml` → `.github/workflows/`, скрипт → `tools/`. Раз в неделю и по кнопке Actions обновляет `data/*_achievements.json` и коммитит, если что-то поменялось.
