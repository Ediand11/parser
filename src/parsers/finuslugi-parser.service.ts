import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { HttpClientService } from '../common/http-client.service';
import { RateLimiterService } from '../common/rate-limiter.service';
import { RobotsValidatorService } from '../common/robots-validator.service';
import { UrlQueueService } from '../crawler/url-queue.service';
import { extractArticle, isArticlePage } from '../common/extract-text.util';

export interface ScrapedArticle {
  mainUrl: string;
  sectionUrl: string | null;
  articleUrl: string;
  title: string;
  content: string;
  scrapedAt: string;
}

@Injectable()
export class FinuslugiParserService {
  private readonly logger = new Logger(FinuslugiParserService.name);
  private readonly BASE_URL = 'https://finuslugi.ru';
  private readonly NAVIGATOR_PATH = '/navigator';
  private readonly USER_AGENT = 'LevScraper/1.0';

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly rateLimiter: RateLimiterService,
    private readonly robotsValidator: RobotsValidatorService,
    private readonly urlQueue: UrlQueueService,
  ) {}

  async initialize(): Promise<void> {
    this.logger.log('Initializing Finuslugi parser...');
    await this.robotsValidator.initialize(this.BASE_URL, this.USER_AGENT);
    this.logger.log('Finuslugi parser initialized');
  }

  async crawl(
    onArticleScraped: (article: ScrapedArticle) => Promise<void>,
    maxArticles = 1000,
  ): Promise<number> {
    this.logger.log('Starting Finuslugi crawl...');

    // Start with base URL
    const startUrl = `${this.BASE_URL}${this.NAVIGATOR_PATH}`;
    this.urlQueue.enqueue(startUrl);

    let articlesScraped = 0;

    while (this.urlQueue.hasMore() && articlesScraped < maxArticles) {
      const url = this.urlQueue.dequeue();
      if (!url) break;

      try {
        // Check robots.txt
        if (!this.isAllowedByRobots(url)) {
          this.logger.debug(`Skipping ${url} - blocked by robots.txt`);
          continue;
        }

        // Check URL validity
        if (!this.isValidFinuslugiUrl(url)) {
          this.logger.debug(`Skipping ${url} - invalid URL pattern`);
          continue;
        }

        // Fetch page with rate limiting
        const html = await this.rateLimiter.schedule(() =>
          this.httpClient.get(url),
        );

        // Extract links and add to queue
        await this.extractAndEnqueueLinks(html, url);

        // Check if this is an article page (not a listing page)
        const isArticle = this.isArticleUrl(url);
        const hasArticleContent = isArticlePage(html);

        this.logger.debug(
          `URL: ${url} - isArticle: ${isArticle}, hasContent: ${hasArticleContent}`,
        );

        if (isArticle && hasArticleContent) {
          const article = this.extractArticleData(html, url);

          if (article && !article.isEmpty) {
            await onArticleScraped({
              mainUrl: `${this.BASE_URL}${this.NAVIGATOR_PATH}`,
              sectionUrl: this.extractSectionUrl(url),
              articleUrl: url,
              title: article.title,
              content: article.content,
              scrapedAt: new Date().toISOString(),
            });

            articlesScraped++;

            if (articlesScraped % 10 === 0) {
              this.logger.log(
                `Progress: ${articlesScraped} articles scraped, ${this.urlQueue.getQueueSize()} in queue, ${this.urlQueue.getVisitedSize()} visited`,
              );
            }
          }
        }
      } catch (error) {
        this.logger.error(`Error processing ${url}:`, error);
        // Continue with next URL
      }
    }

    this.logger.log(`Finuslugi crawl completed: ${articlesScraped} articles scraped`);
    return articlesScraped;
  }

  private extractAndEnqueueLinks(html: string, baseUrl: string): void {
    const $ = cheerio.load(html);
    const links: string[] = [];

    // Find article cards by class prefix (ArticleGrid_card)
    const articleCards = $('[class*="ArticleGrid_card"]');

    if (articleCards.length > 0) {
      this.logger.debug(`Found ${articleCards.length} article cards on page`);

      let totalLinksInCards = 0;
      let validLinks = 0;

      articleCards.each((_, card) => {
        const $card = $(card);

        // Try multiple approaches to find the link:
        // 1. Card itself is a link
        if ($card.is('a')) {
          const href = $card.attr('href');
          if (href) {
            totalLinksInCards++;
            try {
              const absoluteUrl = new URL(href, baseUrl).toString();
              const isValid = this.isValidFinuslugiUrl(absoluteUrl);

              if (totalLinksInCards <= 5) {
                this.logger.debug(
                  `Card is link ${totalLinksInCards}: ${href} (valid: ${isValid})`,
                );
              }

              if (isValid) {
                links.push(absoluteUrl);
                validLinks++;
              }
            } catch (error) {
              if (totalLinksInCards <= 5) {
                this.logger.debug(`Invalid card URL: ${href}`);
              }
            }
          }
        }

        // 2. Look for links inside the card
        $card.find('a[href]').each((_, element) => {
          const href = $(element).attr('href');
          if (!href) return;

          totalLinksInCards++;

          try {
            const absoluteUrl = new URL(href, baseUrl).toString();
            const isValid = this.isValidFinuslugiUrl(absoluteUrl);

            if (totalLinksInCards <= 5) {
              this.logger.debug(
                `Link inside card ${totalLinksInCards}: ${href} (valid: ${isValid})`,
              );
            }

            if (isValid) {
              links.push(absoluteUrl);
              validLinks++;
            }
          } catch (error) {
            if (totalLinksInCards <= 5) {
              this.logger.debug(`Invalid URL: ${href}`);
            }
          }
        });

        // 3. Look for parent link
        const $parentLink = $card.closest('a[href]');
        if ($parentLink.length > 0) {
          const href = $parentLink.attr('href');
          if (href) {
            totalLinksInCards++;
            try {
              const absoluteUrl = new URL(href, baseUrl).toString();
              const isValid = this.isValidFinuslugiUrl(absoluteUrl);

              if (totalLinksInCards <= 5) {
                this.logger.debug(
                  `Parent link ${totalLinksInCards}: ${href} (valid: ${isValid})`,
                );
              }

              if (isValid) {
                links.push(absoluteUrl);
                validLinks++;
              }
            } catch (error) {
              if (totalLinksInCards <= 5) {
                this.logger.debug(`Invalid parent URL: ${href}`);
              }
            }
          }
        }
      });

      this.logger.debug(
        `Total links found: ${totalLinksInCards}, Valid: ${validLinks}`,
      );
    } else {
      // Fallback: extract all links if no cards found
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;

        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          if (this.isValidFinuslugiUrl(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        } catch {
          // Invalid URL, skip
        }
      });
    }

    if (links.length > 0) {
      this.logger.debug(`Enqueueing ${links.length} links from ${baseUrl}`);
      this.logger.debug(`Sample links: ${links.slice(0, 3).join(', ')}`);
    } else {
      this.logger.warn(`No links found on ${baseUrl}`);
    }

    this.urlQueue.enqueueBatch(links);
  }

  private isValidFinuslugiUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Must be same domain
      if (!urlObj.hostname.includes('finuslugi.ru')) {
        return false;
      }

      const path = urlObj.pathname;

      // Must start with /navigator
      if (!path.startsWith(this.NAVIGATOR_PATH)) {
        return false;
      }

      // Block patterns from robots.txt
      if (
        path.includes('/banki/') ||
        path.includes('/ipoteka/') ||
        path.includes('/arhiv_')
      ) {
        return false;
      }

      // Block URLs with tracking parameters
      if (
        urlObj.searchParams.has('yclid') ||
        urlObj.searchParams.has('gclid')
      ) {
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

  private extractArticleData(html: string, url: string) {
    try {
      return extractArticle(html, 'finuslugi');
    } catch (error) {
      this.logger.error(`Failed to extract article from ${url}:`, error);
      return null;
    }
  }

  private isArticleUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // Exclude the base navigator path and listing pages
      if (path === this.NAVIGATOR_PATH || path === `${this.NAVIGATOR_PATH}/`) {
        return false;
      }

      // Article URLs typically have deeper nesting: /navigator/category/article-slug
      const pathParts = path.split('/').filter((p) => p);

      // Must have at least 3 parts: ['navigator', 'category', 'article']
      // or at least 2 if it's a direct article
      return pathParts.length >= 2 && pathParts[0] === 'navigator';
    } catch {
      return false;
    }
  }

  private extractSectionUrl(articleUrl: string): string | null {
    try {
      const urlObj = new URL(articleUrl);
      const pathParts = urlObj.pathname.split('/').filter((p) => p);

      // If path is /navigator/section/article, return /navigator/section
      if (pathParts.length > 2) {
        return `${this.BASE_URL}/${pathParts.slice(0, -1).join('/')}`;
      }

      // Otherwise return the navigator base
      return `${this.BASE_URL}${this.NAVIGATOR_PATH}`;
    } catch {
      return null;
    }
  }
}
