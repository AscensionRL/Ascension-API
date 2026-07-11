import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RlApiService } from '../common/rlapi/rlapi.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rlApi: RlApiService,
  ) {}

  async setEmail(user: User, email: string): Promise<User> {
    if (user.email) {
      throw new BadRequestException('E-Mail ist bereits gesetzt.');
    }
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Diese E-Mail-Adresse ist bereits registriert.');
    }
    return this.mustUpdate(user.id, { email: email.toLowerCase() });
  }

  async setUsername(user: User, username: string): Promise<User> {
    if (user.usernameConfirmed) {
      throw new BadRequestException('Benutzername ist bereits gesetzt.');
    }
    const existing = await this.usersService.findByUsername(username);
    if (existing && existing.id !== user.id) {
      throw new ConflictException('Dieser Benutzername ist bereits vergeben.');
    }
    return this.mustUpdate(user.id, {
      username: username.toLowerCase(),
      usernameConfirmed: true,
      displayName: user.displayName ?? username,
    });
  }

  async setEpicName(user: User, epicName: string): Promise<User> {
    if (user.epicName) {
      throw new BadRequestException('Epic-Name ist bereits gesetzt.');
    }
    const existing = await this.usersService.findByEpicName(epicName);
    if (existing && existing.id !== user.id) {
      throw new ConflictException('Dieser Epic-Name ist bereits verknüpft.');
    }

    const resolved = await this.rlApi.resolveEpic(epicName);
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
    return this.mustUpdate(user.id, {
      epicName,
      epicAccountId: resolved.accountId,
    });
  }

  async setPassword(user: User, password: string): Promise<User> {
    if (user.passwordHash) {
      throw new BadRequestException('Passwort ist bereits gesetzt.');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return this.mustUpdate(user.id, { passwordHash });
  }

  private async mustUpdate(id: string, data: Partial<User>): Promise<User> {
    const updated = await this.usersService.update(id, data);
    if (!updated) {
      throw new BadRequestException('Benutzer nicht gefunden.');
    }
    return updated;
  }
}
