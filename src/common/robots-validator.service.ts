import { Injectable, Logger } from '@nestjs/common';
import robotsParser from 'robots-parser';
import { HttpClientService } from './http-client.service';

@Injectable()
export class RobotsValidatorService {
  private readonly logger = new Logger(RobotsValidatorService.name);
  private parsers: Map<string, any> = new Map();

  constructor(private readonly httpClient: HttpClientService) {}

  async initialize(domain: string, userAgent: string): Promise<void> {
    try {
      const robotsUrl = `${domain}/robots.txt`;
      this.logger.log(`Fetching robots.txt from ${robotsUrl}`);

      const robotsTxt = await this.httpClient.get(robotsUrl);
      const parser = robotsParser(robotsUrl, robotsTxt);

      this.parsers.set(domain, parser);
      this.logger.log(`Robots.txt initialized for ${domain}`);
    } catch (error) {
      this.logger.error(`Failed to initialize robots.txt for ${domain}:`, error);
      // If robots.txt is not available, create a permissive parser
      const parser = robotsParser(`${domain}/robots.txt`, '');
      this.parsers.set(domain, parser);
    }
  }

  isAllowed(url: string, domain: string, userAgent: string): boolean {
    const parser = this.parsers.get(domain);
    if (!parser) {
      this.logger.warn(`No robots.txt parser found for ${domain}, allowing by default`);
      return true;
    }

    return parser.isAllowed(url, userAgent);
  }
}
