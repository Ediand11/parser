import asyncio
import httpx
import logging

logger = logging.getLogger(__name__)


class HttpClient:
    """HTTP клиент с rate limiting и правильным User-Agent."""

    def __init__(self, max_concurrent: int = 3, delay: float = 1.0):
        """
        Args:
            max_concurrent: Максимум параллельных запросов
            delay: Задержка между запросами в секундах
        """
        self._sem = asyncio.Semaphore(max_concurrent)
        self._delay = delay
        self._client = httpx.AsyncClient(
            timeout=15.0,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            },
            http2=False,
            follow_redirects=True,
        )

    async def get_html(self, url: str, referer: str = None) -> str:
        """
        Получить HTML страницы с rate limiting.

        Args:
            url: URL для загрузки
            referer: Optional Referer header

        Returns:
            HTML контент страницы

        Raises:
            httpx.HTTPStatusError: При ошибке HTTP
        """
        async with self._sem:
            logger.debug(f"Fetching: {url}")
            headers = {}
            if referer:
                headers["Referer"] = referer
            resp = await self._client.get(url, headers=headers)
            resp.raise_for_status()
            await asyncio.sleep(self._delay)
            return resp.text

    async def close(self):
        """Закрыть HTTP клиент."""
        await self._client.aclose()
