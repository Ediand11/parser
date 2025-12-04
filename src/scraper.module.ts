import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { HttpClientService } from './common/http-client.service';
import { RateLimiterService } from './common/rate-limiter.service';
import { RobotsValidatorService } from './common/robots-validator.service';
import { UrlQueueService } from './crawler/url-queue.service';
import { CheckpointService } from './crawler/checkpoint.service';
import { FinuslugiParserService } from './parsers/finuslugi-parser.service';
import { TJParserService } from './parsers/tj-parser.service';
import { SitemapParserService } from './parsers/sitemap-parser.service';
import { CsvExportService } from './export/csv-export.service';

@Module({
  providers: [
    ScraperService,
    HttpClientService,
    RateLimiterService,
    RobotsValidatorService,
    UrlQueueService,
    CheckpointService,
    FinuslugiParserService,
    TJParserService,
    SitemapParserService,
    CsvExportService,
  ],
  exports: [ScraperService],
})
export class ScraperModule {}
