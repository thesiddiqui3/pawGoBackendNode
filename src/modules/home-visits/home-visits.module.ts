import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmailModule } from '../../shared/email/email.module';
import { HomeVisitsController } from './home-visits.controller';
import { HomeVisitsService } from './home-visits.service';

@Module({
  imports: [EmailModule],
  controllers: [HomeVisitsController],
  providers: [HomeVisitsService, PrismaService],
})
export class HomeVisitsModule {}
