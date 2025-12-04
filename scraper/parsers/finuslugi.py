import asyncio
import logging
import re
from collections import deque
from typing import List, Set, Tuple, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from scraper.core.http_client import HttpClient
from scraper.core.models import ArticleRow
from scraper.core.utils import extract_text, extract_title

logger = logging.getLogger(__name__)

FINUSLUGI_MAIN = "https://finuslugi.ru"
FINUSLUGI_NAV = f"{FINUSLUGI_MAIN}/navigator"

# Селекторы для контента (с fallback)
CONTENT_SELECTORS = [
    ".NavigatorDetail_articleContentWrapper__EfqF8",
    ".NavigatorDetail_article__1H_V4",
    "article",
    ".article-content"
]


def is_allowed_finuslugi_url(href: str) -> bool:
    """
    Проверка URL по правилам robots.txt для finuslugi.ru.

    Args:
        href: URL для проверки

    Returns:
        True если URL разрешён, False иначе
    """
    if not href:
        return False

    url = href if href.startswith("http") else urljoin(FINUSLUGI_MAIN, href)

    # Запрещённые зоны
    if "/banki/" in url or "/ipoteka/" in url or "/arhiv_" in url:
        return False

    # Запрещённые параметры
    if "yclid=" in url or "gclid=" in url:
        return False

    # Только /navigator
    if "/navigator" not in url:
        return False

    return True


def is_article_url(url: str) -> bool:
    """
    Проверить, является ли URL статьёй.

    Args:
        url: URL для проверки

    Returns:
        True если это статья
    """
    return "/stat_" in url


def extract_section_from_url(url: str) -> str:
    """
    Извлечь раздел из URL статьи.

    Args:
        url: URL статьи вида /navigator/[раздел]/stat_...

    Returns:
        URL раздела
    """
    # Паттерн: /navigator/[раздел]/stat_...
    match = re.match(r"(https?://[^/]+/navigator/[^/]+)/stat_", url)
    if match:
        return match.group(1)
    return FINUSLUGI_NAV


async def crawl_navigator_bfs(
    http: HttpClient, limit: Optional[int] = None
) -> List[Tuple[str, str]]:
    """
    BFS обход /navigator для сбора ссылок на статьи.

    Args:
        http: HTTP клиент
        limit: Максимальное количество статей (None = без ограничений)

    Returns:
        Список кортежей (article_url, section_url)
    """
    queue = deque([FINUSLUGI_NAV])
    visited: Set[str] = set()
    articles: List[Tuple[str, str]] = []

    logger.info(f"Starting BFS crawl from {FINUSLUGI_NAV}")

    while queue and (limit is None or len(articles) < limit):
        current_url = queue.popleft()

        if current_url in visited:
            continue

        visited.add(current_url)
        logger.info(f"Crawling: {current_url} (found {len(articles)} articles)")

        try:
            html = await http.get_html(current_url)
            soup = BeautifulSoup(html, "lxml")

            # Извлечь все ссылки
            for a in soup.find_all("a", href=True):
                href = a["href"]

                # Нормализовать URL
                if not href.startswith("http"):
                    href = urljoin(FINUSLUGI_MAIN, href)

                # Фильтрация
                if not is_allowed_finuslugi_url(href):
                    continue

                if href in visited:
                    continue

                # Если это статья - добавить в результат
                if is_article_url(href):
                    section_url = extract_section_from_url(href)
                    articles.append((href, section_url))
                    visited.add(href)

                    if limit and len(articles) >= limit:
                        logger.info(f"Reached limit of {limit} articles")
                        return articles
                else:
                    # Иначе добавить в очередь для дальнейшего обхода
                    queue.append(href)

        except Exception as e:
            logger.error(f"Error crawling {current_url}: {e}")
            continue

    logger.info(f"BFS complete. Found {len(articles)} articles")
    return articles


async def parse_finuslugi_article(
    http: HttpClient, article_url: str, section_url: str
) -> ArticleRow:
    """
    Парсинг одной статьи finuslugi.ru.

    Args:
        http: HTTP клиент
        article_url: URL статьи
        section_url: URL раздела

    Returns:
        ArticleRow с данными статьи
    """
    html = await http.get_html(article_url)

    title = extract_title(html)
    content = extract_text(html, CONTENT_SELECTORS)

    return ArticleRow(
        main_url=FINUSLUGI_NAV,
        section_url=section_url,
        article_url=article_url,
        title=title,
        content=content,
    )


async def parse_all_finuslugi(
    http: HttpClient, limit: Optional[int] = None
) -> List[ArticleRow]:
    """
    Парсинг всех статей finuslugi.ru/navigator.

    Args:
        http: HTTP клиент
        limit: Максимальное количество статей

    Returns:
        Список ArticleRow
    """
    logger.info("Starting finuslugi.ru parser")

    # Этап 1: Собрать ссылки на статьи через BFS
    articles_info = await crawl_navigator_bfs(http, limit)
    logger.info(f"Found {len(articles_info)} articles to parse")

    # Этап 2: Параллельный парсинг статей
    rows: List[ArticleRow] = []
    tasks = [
        parse_finuslugi_article(http, article_url, section_url)
        for article_url, section_url in articles_info
    ]

    for coro in asyncio.as_completed(tasks):
        try:
            row = await coro
            rows.append(row)
            logger.info(f"Parsed: {row.title[:50]}...")
        except Exception as e:
            logger.error(f"Error parsing article: {e}")

    logger.info(f"Finuslugi parser complete. Parsed {len(rows)} articles")
    return rows
