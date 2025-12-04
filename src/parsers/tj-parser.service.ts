import { Injectable, Logger } from '@nestjs/common';
import { HttpClientService } from '../common/http-client.service';
import { RateLimiterService } from '../common/rate-limiter.service';
import { RobotsValidatorService } from '../common/robots-validator.service';
import { SitemapParserService } from './sitemap-parser.service';
import { extractArticle } from '../common/extract-text.util';
import { ScrapedArticle } from './finuslugi-parser.service';

@Injectable()
export class TJParserService {
  private readonly logger = new Logger(TJParserService.name);
  private readonly BASE_URL = 'https://t-j.ru';
  private readonly SITEMAP_URL = 'https://t-j.ru/sitemap.xml';
  private readonly USER_AGENT = 'LevScraper/1.0';

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly rateLimiter: RateLimiterService,
    private readonly robotsValidator: RobotsValidatorService,
    private readonly sitemapParser: SitemapParserService,
  ) {}

  async initialize(): Promise<void> {
    this.logger.log('Initializing T-J parser...');
    await this.robotsValidator.initialize(this.BASE_URL, this.USER_AGENT);
    this.logger.log('T-J parser initialized');
  }

  async crawl(
    onArticleScraped: (article: ScrapedArticle) => Promise<void>,
    maxArticles = 1000,
  ): Promise<number> {
    this.logger.log('Starting T-J crawl from sitemap...');

    // Fetch all URLs from sitemap index
    const allUrls = await this.sitemapParser.fetchSitemapIndex(
      this.SITEMAP_URL,
    );

    this.logger.log(`Found ${allUrls.length} total URLs in sitemaps`);

    // Filter valid article URLs
    const articleUrls = allUrls.filter((url) => this.isValidTJUrl(url));

    this.logger.log(
      `Filtered to ${articleUrls.length} valid article URLs`,
    );

    let articlesScraped = 0;

    for (const url of articleUrls) {
      if (articlesScraped >= maxArticles) {
        this.logger.log(`Reached max articles limit: ${maxArticles}`);
        break;
      }

      try {
        // Check robots.txt
        if (!this.isAllowedByRobots(url)) {
          this.logger.debug(`Skipping ${url} - blocked by robots.txt`);
          continue;
        }

        // Fetch article with rate limiting
        const html = await this.rateLimiter.schedule(() =>
          this.httpClient.get(url),
        );

        // Extract article content
        const article = extractArticle(html, 'tj');

        if (!article.isEmpty) {
          await onArticleScraped({
            mainUrl: this.BASE_URL,
            sectionUrl: null, // No section concept for sitemap-based crawl
            articleUrl: url,
            title: article.title,
            content: article.content,
            scrapedAt: new Date().toISOString(),
          });

          articlesScraped++;

          if (articlesScraped % 10 === 0) {
            this.logger.log(
              `Progress: ${articlesScraped}/${maxArticles} articles scraped`,
            );
          }
        } else {
          this.logger.warn(`Empty or invalid article at ${url}`);
        }
      } catch (error) {
        this.logger.error(`Error processing ${url}:`, error);
        // Continue with next URL
      }
    }

    this.logger.log(`T-J crawl completed: ${articlesScraped} articles scraped`);
    return articlesScraped;
  }

  private isValidTJUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Must be t-j.ru domain
      if (!urlObj.hostname.includes('t-j.ru')) {
        return false;
      }

      const path = urlObj.pathname;

      // Block patterns from robots.txt
      if (
        path.startsWith('/api/') ||
        path.startsWith('/login/') ||
        path.startsWith('/exam/') ||
        path.startsWith('/recommendations/') ||
        path.startsWith('/look/')
      ) {
        return false;
      }

      // Additional filtering: only include paths that look like articles
      // Typically /some-article-slug or /category/article-slug
      // Skip homepage, category pages, etc.
      if (path === '/' || path.endsWith('/')) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private isAllowedByRobots(url: string): boolean {
    return this.robotsValidator.isAllowed(url, this.BASE_URL, this.USER_AGENT);
  }
}
