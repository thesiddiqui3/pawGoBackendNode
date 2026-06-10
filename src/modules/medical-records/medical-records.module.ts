import { Module } from '@nestjs/common';
import { PetsModule } from '../pets/pets.module';
import { VaccinationsModule } from '../vaccinations/vaccinations.module';
import { MedicalRecordRepository } from './medical-record.repository';
import { MedicalRecordsController, PetHealthController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';

@Module({
  imports: [PetsModule, VaccinationsModule],
  controllers: [MedicalRecordsController, PetHealthController],
  providers: [MedicalRecordsService, MedicalRecordRepository],
  exports: [MedicalRecordsService, MedicalRecordRepository],
})
export class MedicalRecordsModule {}
