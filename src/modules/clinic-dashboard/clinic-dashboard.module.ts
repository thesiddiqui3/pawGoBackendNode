import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ClinicDashboardController } from './clinic-dashboard.controller';
import { ClinicDashboardService } from './clinic-dashboard.service';

@Module({
  controllers: [ClinicDashboardController],
  providers: [ClinicDashboardService, PrismaService],
  exports: [ClinicDashboardService],
})
export class ClinicDashboardModule {}
