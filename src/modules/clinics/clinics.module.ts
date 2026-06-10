import { Module } from '@nestjs/common';
import { ClinicRepository } from './clinic.repository';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';

@Module({
  controllers: [ClinicsController],
  providers: [ClinicsService, ClinicRepository],
  exports: [ClinicsService, ClinicRepository],
})
export class ClinicsModule {}
