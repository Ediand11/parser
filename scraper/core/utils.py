from bs4 import BeautifulSoup
from typing import List


def extract_text(html: str, selectors: List[str]) -> str:
    """
    Извлечь текст из HTML по списку селекторов (с fallback).

    Args:
        html: HTML контент
        selectors: Список CSS селекторов для контейнера (пробуются по порядку)

    Returns:
        Извлечённый текст, склеенный через двойной перенос строки
    """
    soup = BeautifulSoup(html, "lxml")
    container = None

    # Попробовать каждый селектор по порядку
    for selector in selectors:
        container = soup.select_one(selector)
        if container:
            break

    if not container:
        return ""

    parts = []
    for el in container.find_all(["h2", "h3", "p", "li"]):
        text = el.get_text(strip=True)
        if text:
            parts.append(text)

    return "\n\n".join(parts)


def extract_title(html: str) -> str:
    """
    Извлечь заголовок статьи (h1).

    Args:
        html: HTML контент

    Returns:
        Текст заголовка или пустая строка
    """
    soup = BeautifulSoup(html, "lxml")
    title_tag = soup.find("h1")
    return title_tag.get_text(strip=True) if title_tag else ""
