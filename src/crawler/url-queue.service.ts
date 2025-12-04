import { Injectable } from '@nestjs/common';
import { normalizeUrl } from '../common/url-normalizer.util';

@Injectable()
export class UrlQueueService {
  private queue: string[] = [];
  private visited: Set<string> = new Set();

  enqueue(url: string): void {
    const normalized = normalizeUrl(url);
    if (!this.visited.has(normalized) && !this.queue.includes(normalized)) {
      this.queue.push(normalized);
    }
  }

  enqueueBatch(urls: string[]): void {
    urls.forEach((url) => this.enqueue(url));
  }

  dequeue(): string | undefined {
    const url = this.queue.shift();
    if (url) {
      this.visited.add(url);
    }
    return url;
  }

  hasMore(): boolean {
    return this.queue.length > 0;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getVisitedSize(): number {
    return this.visited.size;
  }

  isVisited(url: string): boolean {
    const normalized = normalizeUrl(url);
    return this.visited.has(normalized);
  }

  getState(): { queue: string[]; visited: string[] } {
    return {
      queue: [...this.queue],
      visited: Array.from(this.visited),
    };
  }

  restoreState(state: { queue: string[]; visited: string[] }): void {
    this.queue = [...state.queue];
    this.visited = new Set(state.visited);
  }

  clear(): void {
    this.queue = [];
    this.visited.clear();
  }
}
