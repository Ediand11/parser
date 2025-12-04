Ок, давай теперь план под Python-парсер, с теми же требованиями по robots.txt, rate limit и т.д.

---

## 1. Стек и структура проекта

### Библиотеки

* HTTP:

  * либо синхронно: `requests`
  * либо лучше асинхронно: `httpx[http2]` + `asyncio`
* Парсинг HTML: `beautifulsoup4` + `lxml`
* CSV: стандартный модуль `csv`
* XML (для sitemap t-j.ru): `xml.etree.ElementTree` или `lxml.etree`
* Логи: стандартный `logging`

Пример установки:

```bash
pip install httpx[http2] beautifulsoup4 lxml
```

### Структура проекта

```text
scraper/
  core/
    http_client.py      # общий HTTP клиент с rate limit + UA
    models.py           # dataclass ArticleRow
    utils.py            # парсинг текста из контейнеров, нормализация
  parsers/
    finuslugi.py        # парсер finuslugi.ru/navigator
    tj.py               # парсер t-j.ru
  export/
    csv_export.py       # запись CSV
  main.py               # CLI / точка входа
```

---

## 2. Общая модель данных

```python
# core/models.py
from dataclasses import dataclass

@dataclass
class ArticleRow:
    main_url: str      # https://finuslugi.ru/navigator или https://t-j.ru/
    section_url: str   # раздел/рубрика
    article_url: str   # конкретная статья
    title: str         # заголовок
    content: str       # весь текст статьи (plain text)
```

---

## 3. HTTP-клиент с User-Agent и rate limit

### Требования

* **User-Agent** не должен прикидываться Яндексом/Twitterbot
* 1 запрос/сек (или медленнее), параллельность ограничить

Асинхронный вариант:

```python
# core/http_client.py
import asyncio
import httpx
from typing import Optional

class HttpClient:
    def __init__(self, max_concurrent: int = 3, delay: float = 1.0):
        self._sem = asyncio.Semaphore(max_concurrent)
        self._delay = delay
        self._client = httpx.AsyncClient(
            timeout=15.0,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; LevScraper/1.0; +https://example.com/bot-info)"
                ),
                "Accept-Language": "ru-RU,ru;q=0.9",
            },
            http2=True,
        )

    async def get_html(self, url: str) -> str:
        async with self._sem:
            resp = await self._client.get(url)
            resp.raise_for_status()
            await asyncio.sleep(self._delay)
            return resp.text

    async def close(self):
        await self._client.aclose()
```

---

## 4. Общие утилиты для вытаскивания текста

```python
# core/utils.py
from bs4 import BeautifulSoup

def extract_text(html: str, selector: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    container = soup.select_one(selector)
    if not container:
        return ""

    parts = []
    for el in container.find_all(["h2", "h3", "p", "li"]):
        text = el.get_text(strip=True)
        if text:
            parts.append(text)

    return "\n\n".join(parts)
```

Селекторы (`selector`) ты подберёшь руками через DevTools (типа `.article-body`, `article`, `.content` и т.п.).

---

## 5. Фильтры URL по robots.txt

### 5.1. Finuslugi

```python
# parsers/finuslugi.py
FINUSLUGI_MAIN = "https://finuslugi.ru"
FINUSLUGI_NAV = f"{FINUSLUGI_MAIN}/navigator"

def is_allowed_finuslugi_url(href: str) -> bool:
    if not href:
        return False
    url = href if href.startswith("http") else FINUSLUGI_MAIN + href

    # запрещённые зоны
    if (
        "/banki/" in url or
        "/ipoteka/" in url or
        "/arhiv_" in url
    ):
        return False

    # запрещённые параметры
    if "yclid=" in url or "gclid=" in url:
        return False

    # нас интересуют только материалы в /navigator
    return "/navigator" in url
```

### 5.2. T-J

```python
# parsers/tj.py
TJ_MAIN = "https://t-j.ru"

def is_allowed_tj_url(href: str) -> bool:
    if not href:
        return False
    url = href if href.startswith("http") else TJ_MAIN + href

    if (
        "/api/" in url or
        "/login/" in url or
        "/exam/" in url or
        "/recommendations/" in url or
        "/look/" in url
    ):
        return False

    return True
```

---

## 6. Парсер Finuslugi: стратегия

### 6.1. Как проходить сайт

2 варианта:

1. **Явный список разделов** внутри `/navigator` (ручками собранный):

   * меньше запросов, всё под контролем;
2. Лёгкий **BFS внутри /navigator**:

   * стартуем с `/navigator`;
   * собираем все ссылки с этой страницы;
   * фильтруем `is_allowed_finuslugi_url` + проверяем, не видели ли раньше;
   * для части ссылок считаем их разделами, для части — статьями (по паттернам URL).

Простой вариант: руками завести массив разделов `/navigator/...` и дальше из каждого раздела вытягивать ссылки на статьи по карточкам (селектор карточек внутри страницы).

### 6.2. Получение ссылок на статьи раздела

Псевдокод:

```python
from bs4 import BeautifulSoup
from typing import List, Set

async def get_section_articles(http: HttpClient, section_url: str) -> List[str]:
    html = await http.get_html(section_url)
    soup = BeautifulSoup(html, "lxml")

    urls: Set[str] = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not is_allowed_finuslugi_url(href):
            continue

        # тут ты вводишь свой критерий "это статья", например:
        # - в href есть "/navigator/" и какой-то slug без дополнительных path'ов
        # - либо по CSS-классу карточки (через select)
        abs_url = href if href.startswith("http") else FINUSLUGI_MAIN + href
        urls.add(abs_url)

    # если у раздела есть пагинация - аналогично обрабатываешь page=2,3...
    return list(urls)
```

### 6.3. Парсинг статьи Finuslugi

* через DevTools находишь:

  * селектор `h1` (обычно просто `<h1>`)
  * селектор контейнера с текстом

```python
from core.models import ArticleRow
from core.utils import extract_text

async def parse_finuslugi_article(
    http: HttpClient,
    article_url: str,
    section_url: str,
) -> ArticleRow:
    html = await http.get_html(article_url)
    soup = BeautifulSoup(html, "lxml")

    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else ""

    # селектор подберёшь руками, тут примерный
    content = extract_text(html, ".article-body")

    return ArticleRow(
        main_url=FINUSLUGI_NAV,
        section_url=section_url,
        article_url=article_url,
        title=title,
        content=content,
    )
```

### 6.4. Сборка parse_all

```python
import asyncio

async def parse_all_finuslugi(http: HttpClient, sections: list[str]) -> list[ArticleRow]:
    rows: list[ArticleRow] = []

    for section_url in sections:
        article_urls = await get_section_articles(http, section_url)

        tasks = [
            parse_finuslugi_article(http, url, section_url)
            for url in article_urls
        ]

        for coro in asyncio.as_completed(tasks):
            try:
                row = await coro
                rows.append(row)
            except Exception as e:
                # логируешь и идёшь дальше
                print("finuslugi article error:", e)

    return rows
```

---

## 7. Парсер T-J: лучше через sitemap

### 7.1. Скачиваем sitemap

```python
import xml.etree.ElementTree as ET

SITEMAP_URL = "https://t-j.ru/sitemap.xml"

async def get_tj_article_urls(http: HttpClient) -> list[str]:
    xml_text = await http.get_html(SITEMAP_URL)
    root = ET.fromstring(xml_text)

    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls: list[str] = []

    for url_el in root.findall(".//sm:url", ns):
        loc_el = url_el.find("sm:loc", ns)
        if loc_el is None:
            continue
        loc = loc_el.text or ""
        if not is_allowed_tj_url(loc):
            continue

        # при желании можно ещё фильтровать по паттерну, например,
        # брать только статьи из /{год}/{месяц}/ или по slug'ам
        urls.append(loc)

    return urls
```

### 7.2. Парсинг статьи T-J

Опять же, через DevTools находишь:

* `h1` для заголовка
* основной контейнер статьи (`article`, `.article__content`, и т.п.)

```python
async def parse_tj_article(http: HttpClient, article_url: str) -> ArticleRow:
    html = await http.get_html(article_url)
    soup = BeautifulSoup(html, "lxml")

    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else ""

    content = extract_text(html, "article")  # заменишь на точный селектор

    # section_url здесь можно поставить как "" или логически вывести из URL / или по секции
    return ArticleRow(
        main_url=TJ_MAIN,
        section_url="",  # опционально — выделить раздел из URL
        article_url=article_url,
        title=title,
        content=content,
    )
```

### 7.3. Сборка parse_all

```python
async def parse_all_tj(http: HttpClient, limit: int | None = None) -> list[ArticleRow]:
    article_urls = await get_tj_article_urls(http)
    if limit:
        article_urls = article_urls[:limit]

    tasks = [parse_tj_article(http, url) for url in article_urls]

    rows: list[ArticleRow] = []
    for coro in asyncio.as_completed(tasks):
        try:
            row = await coro
            rows.append(row)
        except Exception as e:
            print("t-j article error:", e)

    return rows
```

---

## 8. Экспорт в CSV

```python
# export/csv_export.py
import csv
from core.models import ArticleRow
from typing import Iterable

def export_to_csv(filename: str, rows: Iterable[ArticleRow]) -> None:
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Основная ссылка",
            "Ссылка на раздел",
            "Ссылка на статью",
            "Название статьи",
            "Вся статья",
        ])
        for r in rows:
            writer.writerow([
                r.main_url,
                r.section_url,
                r.article_url,
                r.title,
                r.content,
            ])
```

---

## 9. Точка входа (main.py)

* забирает флажки из `argparse`:

  * `--site=finuslugi|tj|both`
  * `--output=articles.csv`
  * `--limit` для t-j
* создаёт `HttpClient`
* вызывает нужные `parse_all_*`
* склеивает результат и отдаёт в `export_to_csv`

Псевдокод:

```python
# main.py
import asyncio
import argparse
from core.http_client import HttpClient
from export.csv_export import export_to_csv
from parsers.finuslugi import parse_all_finuslugi
from parsers.tj import parse_all_tj

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", choices=["finuslugi", "tj", "both"], default="both")
    parser.add_argument("--output", default="articles.csv")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    http = HttpClient(max_concurrent=3, delay=1.0)

    rows = []

    if args.site in ("finuslugi", "both"):
        sections = [...]  # руками заданные разделы /navigator
        rows.extend(await parse_all_finuslugi(http, sections))

    if args.site in ("tj", "both"):
        rows.extend(await parse_all_tj(http, limit=args.limit))

    await http.close()
    export_to_csv(args.output, rows)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 10. Что можно навесить сверху (опционально)

* **Кэш** (sqlite / json) уже спарсенных `articleUrl`, чтобы не гонять статьи повторно.
* **Логи по-человечески** через `logging`.
* **Разделы для T-J**: из URL статьи можно вычленить рубрику и проставлять `section_url`.

Если хочешь, дальше могу помочь уже не с планом, а с конкретной реализацией отдельного файла (например, сразу полностью написать `parsers/tj.py` или `main.py`).
