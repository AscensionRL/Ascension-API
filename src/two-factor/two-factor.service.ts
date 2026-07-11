import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { RedisService } from '../common/redis/redis.service';
import { MailService } from '../mail/mail.service';
import { User, TwoFactorMethod } from '../users/user.entity';
import { UsersService } from '../users/users.service';

const TOTP_TOLERANCE = 30;

const SETUP_PREFIX = 'twofa:setup:';
const LOGIN_PREFIX = 'twofa:login:';
const SETUP_TTL = 600;
const LOGIN_TTL = 300;
const ISSUER = 'Ascension';

interface SetupData {
  method: TwoFactorMethod;
  secret?: string;
  code?: string;
}
interface LoginChallenge {
  userId: string;
  code?: string;
}

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly redis: RedisService,
    private readonly usersService: UsersService,
    private readonly mail: MailService,
  ) {}

  private code6(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async startTotpSetup(
    user: User,
  ): Promise<{ qr: string; otpauth: string; secret: string }> {
    const secret = generateSecret();
    const account = user.email || user.username;
    const otpauth = generateURI({ issuer: ISSUER, label: account, secret });
    const qr = await QRCode.toDataURL(otpauth);
    const data: SetupData = { method: 'totp', secret };
    await this.redis.set(`${SETUP_PREFIX}${user.id}`, JSON.stringify(data), SETUP_TTL);
    return { qr, otpauth, secret };
  }

  async startEmailSetup(user: User): Promise<void> {
    if (!user.email) {
      throw new BadRequestException('Für E-Mail-2FA wird eine E-Mail-Adresse benötigt.');
    }
    const code = this.code6();
    const data: SetupData = { method: 'email', code };
    await this.redis.set(`${SETUP_PREFIX}${user.id}`, JSON.stringify(data), SETUP_TTL);
    await this.mail.sendTwoFactorCode(user.email, user.displayName || user.username, code);
  }

  async confirmSetup(user: User, code: string): Promise<User> {
    const raw = await this.redis.get(`${SETUP_PREFIX}${user.id}`);
    if (!raw) {
      throw new BadRequestException('Kein aktiver Einrichtungs-Vorgang. Bitte neu starten.');
    }
    const data = JSON.parse(raw) as SetupData;
    const valid =
      data.method === 'totp'
        ? this.verifyTotp(code, data.secret)
        : data.code === code.trim();
    if (!valid) throw new UnauthorizedException('Der Code ist ungültig.');

    const updated = await this.usersService.update(user.id, {
      twoFactorMethod: data.method,
      totpSecret: data.method === 'totp' ? (data.secret ?? null) : null,
    });
    await this.redis.del(`${SETUP_PREFIX}${user.id}`);
    if (!updated) throw new BadRequestException('Benutzer nicht gefunden.');
    return updated;
  }

  async disable(user: User): Promise<User> {
    const updated = await this.usersService.update(user.id, {
      twoFactorMethod: null,
      totpSecret: null,
    });
    if (!updated) throw new BadRequestException('Benutzer nicht gefunden.');
    return updated;
  }

  async startLoginChallenge(user: User): Promise<string> {
    const token = randomBytes(24).toString('hex');
    const challenge: LoginChallenge = { userId: user.id };
    if (user.twoFactorMethod === 'email' && user.email) {
      const code = this.code6();
      challenge.code = code;
      await this.mail.sendTwoFactorCode(user.email, user.displayName || user.username, code);
    }
    await this.redis.set(`${LOGIN_PREFIX}${token}`, JSON.stringify(challenge), LOGIN_TTL);
    return token;
  }

  async verifyLogin(token: string, code: string): Promise<User> {
    if (!token) throw new UnauthorizedException('2FA-Sitzung abgelaufen.');
    const raw = await this.redis.get(`${LOGIN_PREFIX}${token}`);
    if (!raw) throw new UnauthorizedException('2FA-Sitzung abgelaufen. Bitte neu anmelden.');
    const challenge = JSON.parse(raw) as LoginChallenge;
    const user = await this.usersService.findById(challenge.userId);
    if (!user || !user.twoFactorMethod) {
      throw new UnauthorizedException('Ungültige 2FA-Sitzung.');
    }
    const valid =
      user.twoFactorMethod === 'totp'
        ? this.verifyTotp(code, user.totpSecret)
        : challenge.code === code.trim();
    if (!valid) throw new UnauthorizedException('Der Code ist ungültig.');
    await this.redis.del(`${LOGIN_PREFIX}${token}`);
    return user;
  }

  private verifyTotp(code: string, secret: string | null | undefined): boolean {
    if (!secret) return false;
    try {
      return verifySync({ token: code.trim(), secret, epochTolerance: TOTP_TOLERANCE })
        .valid;
    } catch {
      return false;
    }
  }
}
