import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CheckpointData {
  site: string;
  queueState: {
    queue: string[];
    visited: string[];
  };
  articlesScraped: number;
  lastProcessedUrl: string;
  timestamp: string;
}

@Injectable()
export class CheckpointService {
  private readonly logger = new Logger(CheckpointService.name);
  private checkpointPath: string;

  constructor() {
    this.checkpointPath = path.join(process.cwd(), 'output', 'checkpoint.json');
  }

  async save(data: CheckpointData): Promise<void> {
    try {
      // Ensure output directory exists
      const dir = path.dirname(this.checkpointPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(
        this.checkpointPath,
        JSON.stringify(data, null, 2),
        'utf-8',
      );

      this.logger.log(
        `Checkpoint saved: ${data.articlesScraped} articles, ${data.queueState.queue.length} in queue, ${data.queueState.visited.length} visited`,
      );
    } catch (error) {
      this.logger.error('Failed to save checkpoint:', error);
    }
  }

  async load(): Promise<CheckpointData | null> {
    try {
      const data = await fs.readFile(this.checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(data) as CheckpointData;

      this.logger.log(
        `Checkpoint loaded: ${checkpoint.site} - ${checkpoint.articlesScraped} articles already scraped`,
      );

      return checkpoint;
    } catch (error) {
      this.logger.log('No checkpoint found, starting from scratch');
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.checkpointPath);
      this.logger.log('Checkpoint cleared');
    } catch (error) {
      // File doesn't exist, nothing to clear
    }
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.checkpointPath);
      return true;
    } catch {
      return false;
    }
  }
}
