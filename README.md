# Парсер статей для finuslugi.ru и t-j.ru

Асинхронный Python-парсер для сбора статей с finuslugi.ru и t-j.ru с экспортом в CSV.

## Возможности

- ✅ **finuslugi.ru**: BFS обход /navigator с автоматическим сбором статей
- ⚠️ **t-j.ru**: Парсинг через sitemap (защита QRATOR блокирует доступ к статьям)
- ✅ Rate limiting (1 запрос/сек)
- ✅ Соблюдение robots.txt
- ✅ Экспорт в CSV с 5 колонками
- ✅ Параллельная обработка (до 3 запросов одновременно)
- ✅ Логирование всех операций

## Установка

```bash
# Создать виртуальное окружение
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows

# Установить зависимости
pip install -r requirements.txt
```

## Использование

### Быстрый старт (рекомендуется)

Используйте скрипт `run.sh` который автоматически активирует виртуальное окружение:

```bash
# Парсить только finuslugi.ru (рекомендуется)
./run.sh --site finuslugi --limit 50 --output finuslugi.csv

# Парсить все статьи без ограничений
./run.sh --site finuslugi --output all_articles.csv

# С дебаг логами
./run.sh --site finuslugi --limit 10 --log-level DEBUG
```

### Альтернативный способ (через venv)

Если предпочитаете работать с venv напрямую:

```bash
# 1. Активировать виртуальное окружение
source venv/bin/activate

# 2. Запустить парсер
python3 main.py --site finuslugi --limit 50 --output finuslugi.csv

# 3. Деактивировать (опционально)
deactivate
```

### Другие примеры

```bash
# Парсить оба сайта с ограничением
./run.sh --site both --limit 20 --output articles.csv

# Парсить через venv напрямую (без активации)
venv/bin/python3 main.py --site finuslugi --limit 100 --output articles.csv
```

### Параметры командной строки

- `--site` - Какой сайт парсить: `finuslugi`, `tj`, `both` (по умолчанию: `both`)
- `--output` - Имя выходного CSV файла (по умолчанию: `articles.csv`)
- `--limit` - Максимум статей с каждого сайта (по умолчанию: без ограничений)
- `--log-level` - Уровень логирования: `DEBUG`, `INFO`, `WARNING`, `ERROR` (по умолчанию: `INFO`)

## Структура CSV

CSV файл содержит следующие колонки:

1. **Основная ссылка** - https://finuslugi.ru/navigator или https://t-j.ru/
2. **Ссылка на раздел** - URL раздела/категории
3. **Ссылка на статью** - URL конкретной статьи
4. **Название статьи** - Заголовок (h1)
5. **Вся статья** - Полный текст (h2, h3, p, li элементы)

## Архитектура

```
scraper/
├── core/
│   ├── http_client.py  # HTTP клиент с rate limiting
│   ├── models.py       # ArticleRow dataclass
│   └── utils.py        # Утилиты для извлечения текста
├── parsers/
│   ├── finuslugi.py    # BFS парсер для finuslugi.ru
│   └── tj.py           # Парсер через sitemap для t-j.ru
└── export/
    └── csv_export.py   # Экспорт в CSV

main.py                 # CLI точка входа
run.sh                  # Скрипт запуска (автоматически активирует venv)
requirements.txt        # Зависимости Python
```

## Алгоритмы

### Finuslugi.ru (BFS)

1. Начинает с https://finuslugi.ru/navigator
2. Собирает все ссылки на странице
3. Фильтрует по robots.txt (исключает /banki/, /ipoteka/, tracking параметры)
4. URL со `/stat_` в пути считаются статьями
5. Остальные URL добавляются в очередь для дальнейшего обхода
6. Обрабатывает пагинацию (/navigator/str_2, /navigator/str_3, и т.д.)
7. Останавливается при достижении limit или исчерпании очереди

### T-j.ru (Sitemap)

1. Загружает https://t-j.ru/sitemap-articles.xml
2. Извлекает все URL статей
3. Фильтрует запрещённые пути (/api/, /login/, /exam/, и др.)
4. ⚠️ **ПРОБЛЕМА**: QRATOR защита блокирует доступ к статьям (401 Unauthorized)

## Известные ограничения

### t-j.ru защита QRATOR

T-j.ru использует систему защиты QRATOR, которая блокирует программный доступ:

- ✅ Sitemap доступен
- ❌ Страницы статей возвращают 401 Unauthorized
- ❌ Обход через cookies не помогает
- ❌ Изменение User-Agent не помогает

**Решения**:

1. **Selenium/Playwright** (рекомендуется для t-j.ru):
   ```bash
   pip install playwright
   playwright install chromium
   ```

2. **Scrapy с Splash** - для JavaScript рендеринга

3. **Puppeteer** (Node.js альтернатива)

4. **Ручной обход** - использовать браузер с DevTools

## Соблюдение robots.txt

### Finuslugi.ru

Запрещено:
- `/banki/*`
- `/ipoteka/*`
- `/arhiv_*`
- URL с параметрами `yclid=` или `gclid=`

### T-j.ru

Запрещено:
- `/api/*`
- `/login/*`
- `/exam/*`
- `/recommendations/*`
- `/look/*`

## Примеры вывода

### Успешный запуск

```bash
$ ./run.sh --site finuslugi --limit 10
2025-12-04 22:26:21 - INFO - Парсер статей запущен
2025-12-04 22:26:21 - INFO - Starting BFS crawl from https://finuslugi.ru/navigator
2025-12-04 22:26:26 - INFO - Parsed: 5 выгодных годовых вкладов...
...
2025-12-04 22:26:36 - INFO - Finuslugi parser complete. Parsed 10 articles
2025-12-04 22:26:36 - INFO - Exported 10 articles to articles.csv
```

### Проверка результата

```bash
# Количество строк (должно быть N+1, где N - количество статей)
$ wc -l articles.csv
11 articles.csv

# Первые 3 строки
$ head -n 3 articles.csv
Основная ссылка,Ссылка на раздел,Ссылка на статью,Название статьи,Вся статья
https://finuslugi.ru/navigator,...
```

## Производительность

- **Rate limit**: 1 запрос/секунду
- **Параллельность**: до 3 одновременных запросов
- **Реальная скорость**: ~3 запроса/секунду максимум
- **Finuslugi 100 статей**: ~2-3 минуты (зависит от глубины BFS)

## Устранение неполадок

### Ошибка: ModuleNotFoundError: No module named 'httpx'

Эта ошибка возникает, когда вы запускаете парсер без активации виртуального окружения.

**Решение 1 (рекомендуется):** Используйте скрипт `run.sh`:
```bash
./run.sh --site finuslugi --limit 10 --output test.csv
```

**Решение 2:** Активируйте venv перед запуском:
```bash
source venv/bin/activate
python3 main.py --site finuslugi --limit 10 --output test.csv
```

**Решение 3:** Запускайте через Python из venv:
```bash
venv/bin/python3 main.py --site finuslugi --limit 10 --output test.csv
```

### Зависимости не установлены

Если зависимости не установлены или повреждены:
```bash
source venv/bin/activate
pip install --upgrade -r requirements.txt
```

## Разработка

### Добавление нового сайта

1. Создайте `scraper/parsers/yoursite.py`
2. Реализуйте функции:
   - `is_allowed_yoursite_url(href: str) -> bool`
   - `parse_all_yoursite(http: HttpClient, limit) -> List[ArticleRow]`
3. Добавьте в `main.py`:
   ```python
   if args.site in ("yoursite", "both"):
       rows.extend(await parse_all_yoursite(http, limit=args.limit))
   ```

### Тестирование

```bash
# Быстрый тест с ограничением
./run.sh --site finuslugi --limit 5 --output test.csv

# Проверка логов
./run.sh --site finuslugi --limit 3 --log-level DEBUG

# Или через venv напрямую
source venv/bin/activate
python3 main.py --site finuslugi --limit 5 --output test.csv
```

## Лицензия

MIT

## Автор

Создано согласно требованиям в todo.md
