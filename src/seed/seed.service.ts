import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AscensionStats, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

const BCRYPT_ROUNDS = 12;
const TEST_EPIC_NAME = 'MecryTv';

const DUMMY_STATS: AscensionStats = {
  tourneyWins: 14,
  tourneyLosses: 6,
  tourneysParticipated: 23,
  bestPlacement: { placement: '1. Platz', tourneyName: 'Ascension Winter Cup 2025' },
  lastPlacement: { placement: '5.–8. Platz', tourneyName: 'Ascension Spring Open 2026' },
};

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly usersService: UsersService) {}

  async onModuleInit(): Promise<void> {
    const devMode = (process.env.DEVMODE ?? '').trim().toUpperCase() === 'TRUE';
    if (!devMode) return;

    const username = process.env.TEST_ACCOUNT_USERNAME;
    const email = process.env.TEST_ACCOUNT_EMAIL;
    const password = process.env.TEST_ACCOUNT_PASSWORD;
    if (!username || !email || !password) return;

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      const patch: Partial<User> = {};
      if (!existing.ascensionStats) patch.ascensionStats = DUMMY_STATS;
      if (!existing.epicName || existing.epicName === 'AscensionTest') {
        patch.epicName = TEST_EPIC_NAME;
        patch.epicAccountId = null;
      }
      if (Object.keys(patch).length > 0) {
        await this.usersService.update(existing.id, patch);
      }
      this.writeCredentialsFile(username, email, password);
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.usersService.create({
      username,
      usernameConfirmed: true,
      email,
      passwordHash,
      displayName: 'Ascension Test',
      epicName: TEST_EPIC_NAME,
      emailVerified: true,
      ascensionStats: DUMMY_STATS,
      lastLoginAt: new Date(),
    });

    this.writeCredentialsFile(username, email, password);
    this.logger.log(`Test-Account "${email}" wurde angelegt.`);
  }

  private writeCredentialsFile(username: string, email: string, password: string): void {
    const content = [
      '# Test-Account (nur Entwicklung – NICHT committen)',
      '',
      'Dieser Account wird beim Start automatisch geseedet (siehe backend/src/seed).',
      'Die Werte stammen aus den TEST_ACCOUNT_*-Variablen in backend/.env.',
      '',
      `- Benutzername: ${username}`,
      `- E-Mail:       ${email}`,
      `- Passwort:     ${password}`,
      `- Epic-Name:    ${TEST_EPIC_NAME}`,
      '',
      'Login über E-Mail oder Benutzername + Passwort.',
      '',
    ].join('\n');
    try {
      writeFileSync(join(process.cwd(), 'test-account.md'), content, 'utf8');
    } catch {
      this.logger.warn('Konnte test-account.md nicht schreiben.');
    }
  }
}
