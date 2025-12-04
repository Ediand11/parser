import { Injectable, Logger } from '@nestjs/common';
import { FinuslugiParserService } from './parsers/finuslugi-parser.service';
import { TJParserService } from './parsers/tj-parser.service';
import { CsvExportService } from './export/csv-export.service';
import {
  CheckpointService,
  CheckpointData,
} from './crawler/checkpoint.service';
import { UrlQueueService } from './crawler/url-queue.service';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly finuslugiParser: FinuslugiParserService,
    private readonly tjParser: TJParserService,
    private readonly csvExport: CsvExportService,
    private readonly checkpointService: CheckpointService,
    private readonly urlQueue: UrlQueueService,
  ) {}

  async scrapeAll(maxArticlesPerSite = 500): Promise<void> {
    this.logger.log('Starting scraping process...');

    // Initialize CSV export
    await this.csvExport.initialize();

    // Scrape Finuslugi
    await this.scrapeFinuslugi(maxArticlesPerSite);

    // Scrape T-J
    await this.scrapeTJ(maxArticlesPerSite);

    this.logger.log('Scraping completed!');
    this.logger.log(`CSV file saved at: ${this.csvExport.getCsvPath()}`);
  }

  async scrapeFinuslugi(maxArticles = 500): Promise<void> {
    this.logger.log('=== Starting Finuslugi scraping ===');

    // Check for checkpoint
    const checkpoint = await this.checkpointService.load();
    let articlesScraped = 0;

    if (checkpoint && checkpoint.site === 'finuslugi') {
      this.logger.log(
        `Found checkpoint: ${checkpoint.articlesScraped} articles already scraped`,
      );
      articlesScraped = checkpoint.articlesScraped;
      this.urlQueue.restoreState(checkpoint.queueState);
    }

    // Initialize parser
    await this.finuslugiParser.initialize();

    // Scrape with checkpoint saving
    let checkpointCounter = articlesScraped;

    const result = await this.finuslugiParser.crawl(
      async (article) => {
        await this.csvExport.writeArticle(article);
        checkpointCounter++;

        // Save checkpoint every 50 articles
        if (checkpointCounter % 50 === 0) {
          await this.saveCheckpoint('finuslugi', checkpointCounter);
        }
      },
      maxArticles,
    );

    this.logger.log(`Finuslugi scraping completed: ${result} articles`);

    // Clear checkpoint after successful completion
    await this.checkpointService.clear();
    this.urlQueue.clear();
  }

  async scrapeTJ(maxArticles = 500): Promise<void> {
    this.logger.log('=== Starting T-J scraping ===');

    // Note: T-J uses sitemap, so checkpoint logic is simpler
    // We could skip already-scraped articles by tracking URLs in checkpoint

    // Initialize parser
    await this.tjParser.initialize();

    // Scrape
    const result = await this.tjParser.crawl(
      async (article) => {
        await this.csvExport.writeArticle(article);
      },
      maxArticles,
    );

    this.logger.log(`T-J scraping completed: ${result} articles`);
  }

  private async saveCheckpoint(
    site: string,
    articlesScraped: number,
  ): Promise<void> {
    const checkpoint: CheckpointData = {
      site,
      queueState: this.urlQueue.getState(),
      articlesScraped,
      lastProcessedUrl: '', // Could track this if needed
      timestamp: new Date().toISOString(),
    };

    await this.checkpointService.save(checkpoint);
  }
}
