import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { username: username.toLowerCase() } });
  }

  findByEpicName(epicName: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('u')
      .where('LOWER(u.epicName) = LOWER(:e)', { e: epicName })
      .getOne();
  }

  async findByEmailOrUsername(identifier: string): Promise<User | null> {
    const byEmail = await this.findByEmail(identifier);
    if (byEmail) return byEmail;
    return this.findByUsername(identifier);
  }

  findByDiscordId(discordId: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { discordId } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { googleId } });
  }

  create(data: Partial<User>): Promise<User> {
    const user = this.usersRepo.create({
      ...data,
      email: data.email?.toLowerCase(),
      username: data.username?.toLowerCase(),
    });
    return this.usersRepo.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    await this.usersRepo.update({ id }, data);
    return this.findById(id);
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.usersRepo.update({ id }, { lastLoginAt: new Date() });
  }
}
