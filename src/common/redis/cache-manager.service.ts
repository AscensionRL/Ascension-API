import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheManagerService {
  private readonly DEFAULT_TTL = 86400;

  constructor(private readonly redisService: RedisService) {}

  async getOrFetch<T>(
    cacheKey: string,
    dbQueryFactory: () => Promise<T>,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<T> {
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData) as T;
    }

    const freshData = await dbQueryFactory();

    if (freshData) {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(freshData),
        ttlSeconds,
      );
    }

    return freshData;
  }

  async saveAndCache<T>(
    cacheKey: string,
    dbSaveFactory: () => Promise<T>,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<T> {
    const savedEntity = await dbSaveFactory();

    await this.redisService.set(
      cacheKey,
      JSON.stringify(savedEntity),
      ttlSeconds,
    );

    return savedEntity;
  }

  async invalidate(cacheKey: string): Promise<void> {
    await this.redisService.del(cacheKey);
  }
}
