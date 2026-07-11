import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from '../common/redis/redis.service';

export interface SessionData {
  userId: string;
  createdAt: number;
}

export const SESSION_COOKIE = 'sid';

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const KEY_PREFIX = 'sess:';

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  private key(sid: string): string {
    return `${KEY_PREFIX}${sid}`;
  }

  async create(userId: string): Promise<string> {
    const sid = randomBytes(32).toString('hex');
    const data: SessionData = { userId, createdAt: Date.now() };
    await this.redis.set(this.key(sid), JSON.stringify(data), SESSION_TTL_SECONDS);
    return sid;
  }

  async get(sid: string): Promise<SessionData | null> {
    const raw = await this.redis.get(this.key(sid));
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as SessionData;

      await this.redis.getClient().expire(this.key(sid), SESSION_TTL_SECONDS);
      return data;
    } catch {
      return null;
    }
  }

  async destroy(sid: string): Promise<void> {
    await this.redis.del(this.key(sid));
  }
}
