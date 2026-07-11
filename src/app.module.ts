import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './common/redis/redis.module';
import { RlApiModule } from './common/rlapi/rlapi.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { SettingsModule } from './settings/settings.module';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { RanksModule } from './ranks/ranks.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      autoLoadEntities: true,
      synchronize: (process.env.DEVMODE ?? '').trim().toUpperCase() === 'TRUE',
    }),

    RedisModule,
    RlApiModule,
    MailModule,
    UsersModule,
    AuthModule,
    OnboardingModule,
    SettingsModule,
    TwoFactorModule,
    RanksModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
