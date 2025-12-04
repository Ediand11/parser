import asyncio
import logging
import xml.etree.ElementTree as ET
import re
from typing import List, Optional

from scraper.core.http_client import HttpClient
from scraper.core.models import ArticleRow
from scraper.core.utils import extract_text, extract_title

logger = logging.getLogger(__name__)

TJ_MAIN = "https://t-j.ru"
SITEMAP_URL = "https://t-j.ru/sitemap-articles.xml"

# Селекторы для контента (с fallback)
CONTENT_SELECTORS = ["article", ".article-content", ".content__body", ".content"]


def is_allowed_tj_url(href: str) -> bool:
    """
    Проверка URL по правилам robots.txt для t-j.ru.

    Args:
        href: URL для проверки

    Returns:
        True если URL разрешён, False иначе
    """
    if not href:
        return False

    url = href if href.startswith("http") else TJ_MAIN + href

    # Запрещённые пути
    forbidden_paths = ["/api/", "/login/", "/exam/", "/recommendations/", "/look/"]
    for path in forbidden_paths:
        if path in url:
            return False

    return True


def extract_section_from_tj_url(url: str) -> str:
    """
    Извлечь секцию из URL t-j.ru.

    Args:
        url: URL статьи

    Returns:
        Название секции или пустая строка
    """
    # Паттерн: https://t-j.ru/[категория]/[slug]/
    match = re.match(r"https?://t-j\.ru/([^/]+)/[^/]+/?", url)
    if match:
        category = match.group(1)
        # Пропустить если это slug без категории
        if category not in ["news", "list", "guide", "short"]:
            return ""
        return f"{TJ_MAIN}/{category}"
    return ""


async def get_tj_article_urls(http: HttpClient) -> List[str]:
    """
    Получить список URL статей из sitemap.

    Args:
        http: HTTP клиент

    Returns:
        Список URL статей
    """
    logger.info(f"Fetching sitemap: {SITEMAP_URL}")
    xml_text = await http.get_html(SITEMAP_URL)

    root = ET.fromstring(xml_text)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

    urls: List[str] = []

    for url_el in root.findall(".//sm:url", ns):
        loc_el = url_el.find("sm:loc", ns)
        if loc_el is None:
            continue

        loc = loc_el.text or ""
        if not is_allowed_tj_url(loc):
            continue

        urls.append(loc)

    logger.info(f"Found {len(urls)} articles in sitemap")
    return urls


async def parse_tj_article(http: HttpClient, article_url: str) -> ArticleRow:
    """
    Парсинг одной статьи t-j.ru.

    Args:
        http: HTTP клиент
        article_url: URL статьи

    Returns:
        ArticleRow с данными статьи
    """
    html = await http.get_html(article_url, referer=TJ_MAIN)

    title = extract_title(html)
    content = extract_text(html, CONTENT_SELECTORS)
    section_url = extract_section_from_tj_url(article_url)

    return ArticleRow(
        main_url=TJ_MAIN,
        section_url=section_url,
        article_url=article_url,
        title=title,
        content=content,
    )


async def parse_all_tj(
    http: HttpClient, limit: Optional[int] = None
) -> List[ArticleRow]:
    """
    Парсинг всех статей t-j.ru через sitemap.

    Args:
        http: HTTP клиент
        limit: Максимальное количество статей

    Returns:
        Список ArticleRow
    """
    logger.info("Starting t-j.ru parser")

    # Этап 0: Инициализация сессии (получение cookies)
    try:
        logger.info("Initializing session with t-j.ru")
        await http.get_html(TJ_MAIN)
        logger.info("Session initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize session: {e}")

    # Этап 1: Получить ссылки из sitemap
    article_urls = await get_tj_article_urls(http)

    # Применить limit
    if limit:
        article_urls = article_urls[:limit]
        logger.info(f"Limited to {limit} articles")

    # Этап 2: Параллельный парсинг
    rows: List[ArticleRow] = []
    tasks = [parse_tj_article(http, url) for url in article_urls]

    for coro in asyncio.as_completed(tasks):
        try:
            row = await coro
            rows.append(row)
            logger.info(f"Parsed: {row.title[:50]}...")
        except Exception as e:
            logger.error(f"Error parsing article: {e}")

    logger.info(f"T-J parser complete. Parsed {len(rows)} articles")
    return rows
