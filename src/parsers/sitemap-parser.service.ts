import { Injectable, Logger } from '@nestjs/common';
import Sitemapper from 'sitemapper';

@Injectable()
export class SitemapParserService {
  private readonly logger = new Logger(SitemapParserService.name);

  async fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
    try {
      this.logger.log(`Fetching sitemap from ${sitemapUrl}`);

      const sitemapper = new Sitemapper({
        url: sitemapUrl,
        timeout: 15000,
      });

      const { sites } = await sitemapper.fetch();

      this.logger.log(`Found ${sites.length} URLs in sitemap`);

      return sites;
    } catch (error) {
      this.logger.error(`Failed to fetch sitemap from ${sitemapUrl}:`, error);
      return [];
    }
  }

  async fetchSitemapIndex(sitemapIndexUrl: string): Promise<string[]> {
    this.logger.log(
      `Fetching sitemap index from ${sitemapIndexUrl}`,
    );

    const sitemapper = new Sitemapper({
      url: sitemapIndexUrl,
      timeout: 15000,
    });

    try {
      // First, fetch the sitemap index to get all nested sitemaps
      const { sites: nestedSitemaps } = await sitemapper.fetch();

      this.logger.log(
        `Found ${nestedSitemaps.length} nested sitemaps in index`,
      );

      // Now fetch each nested sitemap and collect all URLs
      const allUrls: string[] = [];

      for (const nestedSitemapUrl of nestedSitemaps) {
        this.logger.log(`Fetching nested sitemap: ${nestedSitemapUrl}`);

        try {
          const nestedSitemapper = new Sitemapper({
            url: nestedSitemapUrl,
            timeout: 15000,
          });

          const { sites } = await nestedSitemapper.fetch();
          allUrls.push(...sites);

          this.logger.log(
            `Collected ${sites.length} URLs from ${nestedSitemapUrl}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to fetch nested sitemap ${nestedSitemapUrl}:`,
            error,
          );
          // Continue with other sitemaps
        }
      }

      this.logger.log(
        `Total URLs collected from all sitemaps: ${allUrls.length}`,
      );

      return allUrls;
    } catch (error) {
      this.logger.error(
        `Failed to fetch sitemap index from ${sitemapIndexUrl}:`,
        error,
      );
      return [];
    }
  }
}
