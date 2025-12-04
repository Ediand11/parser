import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ScraperService } from './scraper.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Check if we should run the scraper
  const runScraper = process.env.RUN_SCRAPER === 'true' || process.argv.includes('--scrape');

  if (runScraper) {
    // Run scraper mode
    console.log('Starting scraper...');
    const scraperService = app.get(ScraperService);

    try {
      await scraperService.scrapeAll(500); // Max 500 articles per site
      console.log('Scraping completed successfully!');
      await app.close();
      process.exit(0);
    } catch (error) {
      console.error('Scraping failed:', error);
      await app.close();
      process.exit(1);
    }
  } else {
    // Run HTTP server mode
    await app.listen(process.env.PORT ?? 3000);
    console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  }
}
bootstrap();
