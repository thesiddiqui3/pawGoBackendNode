import { Module } from '@nestjs/common';
import { PetsModule } from '../pets/pets.module';
import { VaccinationRepository } from './vaccination.repository';
import { PetVaccinationsController, VaccinationsController } from './vaccinations.controller';
import { VaccinationsService } from './vaccinations.service';

@Module({
  imports: [PetsModule],
  controllers: [VaccinationsController, PetVaccinationsController],
  providers: [VaccinationsService, VaccinationRepository],
  exports: [VaccinationsService, VaccinationRepository],
})
export class VaccinationsModule {}
