import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ClinicReportsController } from './clinic-reports.controller';
import { ClinicReportsService } from './clinic-reports.service';

@Module({
  controllers: [ClinicReportsController],
  providers: [ClinicReportsService, PrismaService],
})
export class ClinicReportsModule {}
