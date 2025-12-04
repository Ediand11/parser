#!/usr/bin/env python3
"""
Парсер статей для finuslugi.ru и t-j.ru с экспортом в CSV.
"""
import asyncio
import argparse
import logging

from scraper.core.http_client import HttpClient
from scraper.export.csv_export import export_to_csv
from scraper.parsers.finuslugi import parse_all_finuslugi
from scraper.parsers.tj import parse_all_tj


def setup_logging(level: str = "INFO"):
    """Настройка логирования."""
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


async def main():
    """Главная функция парсера."""
    parser = argparse.ArgumentParser(
        description="Парсер статей для finuslugi.ru и t-j.ru"
    )
    parser.add_argument(
        "--site",
        choices=["finuslugi", "tj", "both"],
        default="both",
        help="Какой сайт парсить (по умолчанию: both)",
    )
    parser.add_argument(
        "--output",
        default="articles.csv",
        help="Имя выходного CSV файла (по умолчанию: articles.csv)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Максимальное количество статей с каждого сайта (по умолчанию: без ограничений)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Уровень логирования (по умолчанию: INFO)",
    )

    args = parser.parse_args()

    # Настройка логирования
    setup_logging(args.log_level)
    logger = logging.getLogger(__name__)

    logger.info("=" * 60)
    logger.info("Парсер статей запущен")
    logger.info(f"Сайты: {args.site}")
    logger.info(f"Лимит: {args.limit if args.limit else 'без ограничений'}")
    logger.info(f"Выход: {args.output}")
    logger.info("=" * 60)

    # Создание HTTP клиента
    http = HttpClient(max_concurrent=3, delay=1.0)

    rows = []

    try:
        # Парсинг finuslugi.ru
        if args.site in ("finuslugi", "both"):
            logger.info("\n" + "=" * 60)
            logger.info("Начало парсинга finuslugi.ru")
            logger.info("=" * 60)
            finuslugi_rows = await parse_all_finuslugi(http, limit=args.limit)
            rows.extend(finuslugi_rows)
            logger.info(f"Получено {len(finuslugi_rows)} статей с finuslugi.ru")

        # Парсинг t-j.ru
        if args.site in ("tj", "both"):
            logger.info("\n" + "=" * 60)
            logger.info("Начало парсинга t-j.ru")
            logger.info("=" * 60)
            tj_rows = await parse_all_tj(http, limit=args.limit)
            rows.extend(tj_rows)
            logger.info(f"Получено {len(tj_rows)} статей с t-j.ru")

    finally:
        # Закрыть HTTP клиент
        await http.close()

    # Экспорт в CSV
    logger.info("\n" + "=" * 60)
    logger.info("Экспорт результатов")
    logger.info("=" * 60)
    export_to_csv(args.output, rows)

    logger.info("\n" + "=" * 60)
    logger.info("Парсинг завершён")
    logger.info(f"Всего статей: {len(rows)}")
    logger.info(f"Результат: {args.output}")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
