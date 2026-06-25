import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheManagerService } from './cache-manager.service';

@Global()
@Module({
  providers: [RedisService, CacheManagerService],
  exports: [RedisService, CacheManagerService],
})
export class RedisModule {}
