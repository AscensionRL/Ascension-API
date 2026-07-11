import { Global, Module } from '@nestjs/common';
import { RlApiService } from './rlapi.service';

@Global()
@Module({
  providers: [RlApiService],
  exports: [RlApiService],
})
export class RlApiModule {}
