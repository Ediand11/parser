import { Injectable } from '@nestjs/common';
import Bottleneck from 'bottleneck';

@Injectable()
export class RateLimiterService {
  private limiter: Bottleneck;

  constructor() {
    this.limiter = new Bottleneck({
      minTime: 1000, // 1000ms между запросами
      maxConcurrent: 1, // Только 1 запрос одновременно
    });
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter.schedule(fn);
  }
}
