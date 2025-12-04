import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; LevScraper/1.0; +https://example.com/bot-info)',
      },
    });

    // Retry configuration
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors or 5xx server errors
        const status = error.response?.status;
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (status !== undefined && status >= 500 && status < 600)
        );
      },
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn(
          `Retry attempt ${retryCount} for ${requestConfig.url}`,
        );
      },
    });
  }

  async get(url: string): Promise<string> {
    try {
      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to fetch ${url}: ${error.response?.status} ${error.message}`,
        );
      } else {
        this.logger.error(`Failed to fetch ${url}:`, error);
      }
      throw error;
    }
  }
}
