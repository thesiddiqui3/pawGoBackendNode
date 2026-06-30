import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { EmailModule } from '../../shared/email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
