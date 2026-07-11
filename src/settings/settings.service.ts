import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RlApiService } from '../common/rlapi/rlapi.service';
import {
  User,
  usernameChangeAvailableAt,
  USERNAME_COOLDOWN_DAYS,
} from '../users/user.entity';
import { UsersService } from '../users/users.service';
import {
  ChangeEmailDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/settings.dto';

const BCRYPT_ROUNDS = 12;
const ALLOWED_REGIONS = ['DE', 'AT', 'CH'];

@Injectable()
export class SettingsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rlApi: RlApiService,
  ) {}

  async updateProfile(user: User, dto: UpdateProfileDto): Promise<User> {
    const patch: Partial<User> = {};

    if (dto.username !== undefined && dto.username.toLowerCase() !== user.username) {
      const availableAt = usernameChangeAvailableAt(user);
      if (availableAt) {
        throw new BadRequestException(
          `Der Benutzername kann nur alle ${USERNAME_COOLDOWN_DAYS} Tage geändert werden. ` +
            `Nächste Änderung ab ${availableAt.toLocaleDateString('de-DE')} möglich.`,
        );
      }
      const existing = await this.usersService.findByUsername(dto.username);
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Dieser Benutzername ist bereits vergeben.');
      }
      patch.username = dto.username.toLowerCase();
      patch.usernameConfirmed = true;
      patch.usernameChangedAt = new Date();
    }

    if (dto.displayName !== undefined) {
      patch.displayName = dto.displayName.trim() || null;
    }

    if (dto.avatarUrl !== undefined) {
      patch.avatarUrl = dto.avatarUrl.trim() || null;
    }

    if (dto.region !== undefined) {
      const region = dto.region.trim().toUpperCase();
      if (region && !ALLOWED_REGIONS.includes(region)) {
        throw new BadRequestException('Ungültige Region (erlaubt: DE, AT, CH).');
      }
      patch.region = region || null;
    }

    if (dto.bio !== undefined) {
      patch.bio = dto.bio.trim() || null;
    }

    if (dto.epicName !== undefined && dto.epicName !== user.epicName) {
      const existing = await this.usersService.findByEpicName(dto.epicName);
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Dieser Epic-Name ist bereits verknüpft.');
      }
      const resolved = await this.rlApi.resolveEpic(dto.epicName);
      if (resolved.status === 'unavailable') {
        throw new ServiceUnavailableException(
          'Die Epic-Prüfung ist gerade nicht verfügbar. Bitte später erneut versuchen.',
        );
      }
      if (resolved.status === 'not_found') {
        throw new BadRequestException(
          'Dieser Epic-Name wurde in Rocket League nicht gefunden.',
        );
      }
      patch.epicName = dto.epicName;
      patch.epicAccountId = resolved.accountId;
    }

    if (Object.keys(patch).length === 0) return user;
    return this.mustUpdate(user.id, patch);
  }

  async setAvatar(user: User, url: string): Promise<User> {
    return this.mustUpdate(user.id, { avatarUrl: url });
  }

  async changeEmail(user: User, dto: ChangeEmailDto): Promise<User> {
    const email = dto.newEmail.trim().toLowerCase();
    if (email === user.email) {
      throw new BadRequestException('Das ist bereits deine aktuelle E-Mail-Adresse.');
    }
    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('Bitte bestätige die Änderung mit deinem Passwort.');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Aktuelles Passwort ist falsch.');
      }
    }
    const existing = await this.usersService.findByEmail(email);
    if (existing && existing.id !== user.id) {
      throw new ConflictException('Diese E-Mail-Adresse ist bereits registriert.');
    }
    return this.mustUpdate(user.id, { email, emailVerified: false });
  }

  async changePassword(user: User, dto: ChangePasswordDto): Promise<User> {

    if (user.passwordHash) {
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Aktuelles Passwort ist falsch.');
      }
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    return this.mustUpdate(user.id, { passwordHash });
  }

  private async mustUpdate(id: string, data: Partial<User>): Promise<User> {
    const updated = await this.usersService.update(id, data);
    if (!updated) throw new BadRequestException('Benutzer nicht gefunden.');
    return updated;
  }
}
