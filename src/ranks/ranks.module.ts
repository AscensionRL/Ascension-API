import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RanksController } from './ranks.controller';
import { RanksService } from './ranks.service';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [RanksController],
  providers: [RanksService],
})
export class RanksModule {}
