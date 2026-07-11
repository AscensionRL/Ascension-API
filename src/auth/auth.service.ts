import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(dto: RegisterDto): Promise<User> {
    const existingEmail = await this.usersService.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException('Diese E-Mail-Adresse ist bereits registriert.');
    }
    const existingUsername = await this.usersService.findByUsername(dto.username);
    if (existingUsername) {
      throw new ConflictException('Dieser Benutzername ist bereits vergeben.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.usersService.create({
      username: dto.username,
      usernameConfirmed: true,
      email: dto.email,
      passwordHash,
      displayName: dto.username,
      lastLoginAt: new Date(),
    });
  }

  async validateLogin(dto: LoginDto): Promise<User> {
    const user = await this.usersService.findByEmailOrUsername(dto.identifier);
    if (!user || !user.passwordHash) {

      throw new UnauthorizedException('E-Mail/Benutzername oder Passwort ist falsch.');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('E-Mail/Benutzername oder Passwort ist falsch.');
    }
    await this.usersService.touchLastLogin(user.id);
    return user;
  }
}
