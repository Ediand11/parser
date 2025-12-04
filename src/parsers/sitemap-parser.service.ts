import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SitemapParserService {
  private readonly logger = new Logger(SitemapParserService.name);
  private Sitemapper: any;

  private async loadSitemapper() {
    if (!this.Sitemapper) {
      // Dynamic import for ESM module
      const module = await import('sitemapper');
      this.Sitemapper = module.default;
    }
    return this.Sitemapper;
  }

  async fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
    try {
      this.logger.log(`Fetching sitemap from ${sitemapUrl}`);

      const SitemapperClass = await this.loadSitemapper();
      const sitemapper = new SitemapperClass({
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
    this.logger.log(`Fetching sitemap index from ${sitemapIndexUrl}`);

    try {
      const SitemapperClass = await this.loadSitemapper();
      const sitemapper = new SitemapperClass({
        url: sitemapIndexUrl,
        timeout: 15000,
      });

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
          const nestedSitemapper = new SitemapperClass({
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
