import { Module } from '@nestjs/common';
import { PetRepository } from './pet.repository';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';

@Module({
  controllers: [PetsController],
  providers: [PetsService, PetRepository],
  exports: [PetsService, PetRepository],
})
export class PetsModule {}
