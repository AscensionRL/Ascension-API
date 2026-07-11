import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  PublicUser,
  toPublicUser,
  TwoFactorMethod,
  User,
} from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { TwoFactorCodeDto } from '../two-factor/dto/two-factor.dto';
import { AuthService } from './auth.service';
import {
  clearPending2faCookie,
  clearSessionCookie,
  PENDING_2FA_COOKIE,
  setPending2faCookie,
  setSessionCookie,
} from './cookie.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OAuthProfile, OAuthProvider, OAuthService } from './oauth.service';
import { SESSION_COOKIE, SessionService } from './session.service';

type LoginResult = PublicUser | { twoFactorRequired: true; method: TwoFactorMethod };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly oauthService: OAuthService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const user = await this.authService.register(dto);
    await this.startSession(res, user.id);
    return toPublicUser(user);
  }

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    const user = await this.authService.validateLogin(dto);

    if (user.twoFactorMethod) {
      const token = await this.twoFactor.startLoginChallenge(user);
      setPending2faCookie(res, token);
      return { twoFactorRequired: true, method: user.twoFactorMethod };
    }

    await this.startSession(res, user.id);
    return toPublicUser(user);
  }

  @Post('2fa/verify')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async verifyTwoFactor(
    @Body() dto: TwoFactorCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const token = req.cookies?.[PENDING_2FA_COOKIE];
    const user = await this.twoFactor.verifyLogin(token, dto.code);
    await this.startSession(res, user.id);
    await this.usersService.touchLastLogin(user.id);
    clearPending2faCookie(res);
    return toPublicUser(user);
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (sid) await this.sessionService.destroy(sid);
    clearSessionCookie(res);
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request): Promise<PublicUser | null> {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (!sid) return null;
    const session = await this.sessionService.get(sid);
    if (!session) return null;
    const user = await this.usersService.findById(session.userId);
    return user ? toPublicUser(user) : null;
  }

  @Get('discord')
  async discord(@Res() res: Response): Promise<void> {
    await this.redirectToProvider('discord', res);
  }

  @Get('discord/callback')
  async discordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleOAuthCallback('discord', code, state, req, res);
  }

  @Get('google')
  async google(@Res() res: Response): Promise<void> {
    await this.redirectToProvider('google', res);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleOAuthCallback('google', code, state, req, res);
  }

  private async startSession(res: Response, userId: string): Promise<void> {
    const sid = await this.sessionService.create(userId);
    setSessionCookie(res, sid);
  }

  private frontendUrl(): string {
    const dev = (process.env.DEVMODE ?? '').trim().toUpperCase() === 'TRUE';
    return (
      (dev ? process.env.FRONTEND_DEV_URL : process.env.FRONTEND_URL) ??
      'http://localhost:5173'
    );
  }

  private async redirectToProvider(
    provider: OAuthProvider,
    res: Response,
  ): Promise<void> {
    const state = await this.oauthService.createState(provider);
    res.redirect(this.oauthService.getAuthUrl(provider, state));
  }

  private async handleOAuthCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const frontend = this.frontendUrl();

    const sid = req.cookies?.[SESSION_COOKIE];
    const session = sid ? await this.sessionService.get(sid) : null;
    const sessionUser = session
      ? await this.usersService.findById(session.userId)
      : null;

    if (sessionUser) {
      try {
        if (!code) throw new BadRequestException('Kein Code erhalten.');
        await this.oauthService.consumeState(provider, state);
        const profile = await this.oauthService.fetchProfile(provider, code);
        await this.linkProvider(sessionUser, profile);
        res.redirect(`${frontend}/dashboard/settings?linked=${provider}`);
      } catch {
        res.redirect(`${frontend}/dashboard/settings?link_error=${provider}`);
      }
      return;
    }

    try {
      if (!code) throw new BadRequestException('Kein Code erhalten.');
      await this.oauthService.consumeState(provider, state);
      const profile = await this.oauthService.fetchProfile(provider, code);
      const user = await this.upsertOAuthUser(profile);
      await this.startSession(res, user.id);
      await this.usersService.touchLastLogin(user.id);
      res.redirect(`${frontend}/dashboard`);
    } catch {

      res.redirect(`${frontend}/?auth_error=${provider}`);
    }
  }

  private async linkProvider(user: User, profile: OAuthProfile): Promise<void> {
    const existing =
      profile.provider === 'discord'
        ? await this.usersService.findByDiscordId(profile.providerId)
        : await this.usersService.findByGoogleId(profile.providerId);
    if (existing && existing.id !== user.id) {
      throw new BadRequestException(
        'Dieses Konto ist bereits mit einem anderen Account verknüpft.',
      );
    }
    const link: Partial<User> =
      profile.provider === 'discord'
        ? { discordId: profile.providerId }
        : { googleId: profile.providerId };
    await this.usersService.update(user.id, {
      ...link,
      avatarUrl: user.avatarUrl ?? profile.avatarUrl,
    });
  }

  private async upsertOAuthUser(profile: OAuthProfile): Promise<User> {

    const providerLink: Partial<User> =
      profile.provider === 'discord'
        ? { discordId: profile.providerId }
        : { googleId: profile.providerId };

    const byProvider =
      profile.provider === 'discord'
        ? await this.usersService.findByDiscordId(profile.providerId)
        : await this.usersService.findByGoogleId(profile.providerId);
    if (byProvider) {
      if (!byProvider.avatarUrl && profile.avatarUrl) {
        return (await this.usersService.update(byProvider.id, {
          avatarUrl: profile.avatarUrl,
        }))!;
      }
      return byProvider;
    }

    if (profile.email) {
      const byEmail = await this.usersService.findByEmail(profile.email);
      if (byEmail) {
        return (await this.usersService.update(byEmail.id, {
          ...providerLink,
          avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl,
          emailVerified: byEmail.emailVerified || profile.emailVerified,
        }))!;
      }
    }

    if (!profile.email) {
      throw new BadRequestException(
        'Für die Registrierung wird eine E-Mail-Adresse benötigt.',
      );
    }
    const username = await this.generateUniqueUsername(profile.suggestedUsername);
    return this.usersService.create({
      ...providerLink,
      username,

      usernameConfirmed: false,
      email: profile.email,
      passwordHash: null,
      displayName: profile.displayName ?? username,
      avatarUrl: profile.avatarUrl,
      emailVerified: profile.emailVerified,
      lastLoginAt: new Date(),
    });
  }

  private async generateUniqueUsername(suggested: string): Promise<string> {
    const cleaned = suggested.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40);
    const base = cleaned.length >= 3 ? cleaned : `spieler${cleaned}`;

    if (!(await this.usersService.findByUsername(base))) return base;
    for (let i = 0; i < 20; i++) {
      const candidate = `${base.slice(0, 44)}_${Math.floor(1000 + Math.random() * 9000)}`;
      if (!(await this.usersService.findByUsername(candidate))) return candidate;
    }

    return `${base.slice(0, 40)}_${Date.now().toString().slice(-6)}`;
  }
}
