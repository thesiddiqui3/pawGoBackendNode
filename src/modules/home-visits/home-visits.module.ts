import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { HomeVisitsController } from './home-visits.controller';
import { HomeVisitsService } from './home-visits.service';

@Module({
  controllers: [HomeVisitsController],
  providers: [HomeVisitsService, PrismaService],
})
export class HomeVisitsModule {}
