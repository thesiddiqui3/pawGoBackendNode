import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ClinicPatientsController } from './clinic-patients.controller';
import { ClinicPatientsService } from './clinic-patients.service';

@Module({
  controllers: [ClinicPatientsController],
  providers: [ClinicPatientsService, PrismaService],
})
export class ClinicPatientsModule {}
