import csv
import logging
from typing import Iterable

from scraper.core.models import ArticleRow

logger = logging.getLogger(__name__)


def export_to_csv(filename: str, rows: Iterable[ArticleRow]) -> None:
    """
    Экспорт статей в CSV файл.

    Args:
        filename: Путь к выходному CSV файлу
        rows: Итератор ArticleRow для экспорта
    """
    logger.info(f"Exporting to {filename}")

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        # Заголовки
        writer.writerow([
            "Основная ссылка",
            "Ссылка на раздел",
            "Ссылка на статью",
            "Название статьи",
            "Вся статья",
        ])

        # Данные
        count = 0
        for r in rows:
            writer.writerow([
                r.main_url,
                r.section_url,
                r.article_url,
                r.title,
                r.content,
            ])
            count += 1

    logger.info(f"Exported {count} articles to {filename}")
