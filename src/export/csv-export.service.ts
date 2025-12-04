import { Injectable, Logger } from '@nestjs/common';
import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ScrapedArticle } from '../parsers/finuslugi-parser.service';

@Injectable()
export class CsvExportService {
  private readonly logger = new Logger(CsvExportService.name);
  private csvWriter: any;
  private csvPath: string;
  private isInitialized = false;

  async initialize(outputPath?: string): Promise<void> {
    this.csvPath = outputPath || path.join(process.cwd(), 'output', 'articles.csv');

    // Ensure output directory exists
    const dir = path.dirname(this.csvPath);
    await fs.mkdir(dir, { recursive: true });

    // Check if file exists to determine if we need headers
    const fileExists = await this.fileExists(this.csvPath);

    this.csvWriter = createObjectCsvWriter({
      path: this.csvPath,
      header: [
        { id: 'mainUrl', title: 'Основная ссылка' },
        { id: 'sectionUrl', title: 'Ссылка на раздел' },
        { id: 'articleUrl', title: 'Ссылка на статью' },
        { id: 'title', title: 'Название статьи' },
        { id: 'content', title: 'Вся статья' },
        { id: 'scrapedAt', title: 'Дата скрапинга' },
      ],
      encoding: 'utf8',
      append: fileExists, // Append if file exists, otherwise create new
    });

    this.isInitialized = true;
    this.logger.log(`CSV export initialized at ${this.csvPath}`);
  }

  async writeArticle(article: ScrapedArticle): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('CSV export service not initialized. Call initialize() first.');
    }

    try {
      await this.csvWriter.writeRecords([
        {
          mainUrl: article.mainUrl,
          sectionUrl: article.sectionUrl || '',
          articleUrl: article.articleUrl,
          title: article.title,
          content: article.content,
          scrapedAt: article.scrapedAt,
        },
      ]);
    } catch (error) {
      this.logger.error(`Failed to write article to CSV:`, error);
      throw error;
    }
  }

  async writeArticles(articles: ScrapedArticle[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('CSV export service not initialized. Call initialize() first.');
    }

    try {
      const records = articles.map((article) => ({
        mainUrl: article.mainUrl,
        sectionUrl: article.sectionUrl || '',
        articleUrl: article.articleUrl,
        title: article.title,
        content: article.content,
        scrapedAt: article.scrapedAt,
      }));

      await this.csvWriter.writeRecords(records);
      this.logger.log(`Wrote ${records.length} articles to CSV`);
    } catch (error) {
      this.logger.error(`Failed to write articles to CSV:`, error);
      throw error;
    }
  }

  getCsvPath(): string {
    return this.csvPath;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
