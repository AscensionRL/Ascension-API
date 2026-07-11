import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';
import { RanksResponse, RanksService } from './ranks.service';

@Controller('ranks')
@UseGuards(AuthGuard)
export class RanksController {
  constructor(private readonly ranks: RanksService) {}

  @Get('me')
  getMine(@CurrentUser() user: User): Promise<RanksResponse> {
    return this.ranks.getForUser(user);
  }
}
