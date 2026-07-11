import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from '../common/redis/redis.service';

export type OAuthProvider = 'discord' | 'google';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string | null;
  emailVerified: boolean;
  suggestedUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const STATE_TTL = 600;
const STATE_PREFIX = 'oauthstate:';

@Injectable()
export class OAuthService {
  constructor(private readonly redis: RedisService) {}

  private isDev(): boolean {
    return (process.env.DEVMODE ?? '').trim().toUpperCase() === 'TRUE';
  }

  private redirectUri(provider: OAuthProvider): string {
    if (provider === 'discord') {
      return this.isDev()
        ? (process.env.DISCORD_DEV_REDIRECT_URI ?? '')
        : (process.env.DISCORD_REDIRECT_URI ?? '');
    }
    return this.isDev()
      ? (process.env.GOOGLE_DEV_REDIRECT_URI ?? '')
      : (process.env.GOOGLE_REDIRECT_URI ?? '');
  }

  async createState(provider: OAuthProvider): Promise<string> {
    const state = randomBytes(16).toString('hex');
    await this.redis.set(`${STATE_PREFIX}${state}`, provider, STATE_TTL);
    return state;
  }

  async consumeState(provider: OAuthProvider, state?: string): Promise<void> {

    if (!state) return;
    const stored = await this.redis.get(`${STATE_PREFIX}${state}`);
    if (stored !== provider) throw new BadRequestException('Ungültiger OAuth-State.');
    await this.redis.del(`${STATE_PREFIX}${state}`);
  }

  getAuthUrl(provider: OAuthProvider, state: string): string {
    if (provider === 'discord') {

      const base = this.isDev()
        ? process.env.DISCORD_DEV_OAUTH2
        : process.env.DISCORD_OAUTH2;
      if (base) {
        const sep = base.includes('?') ? '&' : '?';
        return `${base}${sep}state=${encodeURIComponent(state)}`;
      }

      const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID ?? '',
        redirect_uri: this.redirectUri('discord'),
        response_type: 'code',
        scope: 'identify email guilds guilds.join',
        state,
      });
      return `https://discord.com/oauth2/authorize?${params.toString()}`;
    }

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: this.redirectUri('google'),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async fetchProfile(provider: OAuthProvider, code: string): Promise<OAuthProfile> {
    return provider === 'discord'
      ? this.fetchDiscordProfile(code)
      : this.fetchGoogleProfile(code);
  }

  private async fetchDiscordProfile(code: string): Promise<OAuthProfile> {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID ?? '',
        client_secret: process.env.DISCORD_CLIENT_SECRET ?? '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri('discord'),
      }),
    });
    if (!tokenRes.ok) {
      throw new BadRequestException('Discord-Token konnte nicht geholt werden.');
    }
    const token = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) {
      throw new BadRequestException('Discord-Profil konnte nicht geladen werden.');
    }
    const u = (await userRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      email?: string | null;
      verified?: boolean;
      avatar?: string | null;
    };

    const avatarUrl = u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256`
      : null;

    return {
      provider: 'discord',
      providerId: u.id,
      email: u.email ?? null,
      emailVerified: !!u.verified,
      suggestedUsername: u.global_name || u.username,
      displayName: u.global_name || u.username,
      avatarUrl,
    };
  }

  private async fetchGoogleProfile(code: string): Promise<OAuthProfile> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri('google'),
      }),
    });
    if (!tokenRes.ok) {
      throw new BadRequestException('Google-Token konnte nicht geholt werden.');
    }
    const token = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) {
      throw new BadRequestException('Google-Profil konnte nicht geladen werden.');
    }
    const u = (await userRes.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    return {
      provider: 'google',
      providerId: u.sub,
      email: u.email ?? null,
      emailVerified: !!u.email_verified,
      suggestedUsername: u.name || (u.email ? u.email.split('@')[0] : 'spieler'),
      displayName: u.name ?? null,
      avatarUrl: u.picture ?? null,
    };
  }
}
