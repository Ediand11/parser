export default () => ({
  scraper: {
    userAgent:
      'Mozilla/5.0 (compatible; LevScraper/1.0; +https://example.com/bot-info)',
    rateLimit: {
      minTimeBetweenRequests: 1000, // 1 sec
      maxConcurrent: 1,
    },
    retry: {
      maxRetries: 3,
      exponentialBackoff: true,
    },
    timeout: 30000, // 30 sec
  },
  sites: {
    finuslugi: {
      baseUrl: 'https://finuslugi.ru/navigator',
      domain: 'https://finuslugi.ru',
      robotsUrl: 'https://finuslugi.ru/robots.txt',
      selectors: {
        title: 'h1', // TODO: Проверить в DevTools
        content: '.article-content', // TODO: Проверить в DevTools
      },
    },
    tj: {
      baseUrl: 'https://t-j.ru',
      sitemapUrl: 'https://t-j.ru/sitemap.xml',
      robotsUrl: 'https://t-j.ru/robots.txt',
      selectors: {
        title: 'h1',
        content: '.content__body', // TODO: Проверить в DevTools
      },
    },
  },
  output: {
    csvPath: './output/articles.csv',
    checkpointPath: './output/checkpoint.json',
  },
});
