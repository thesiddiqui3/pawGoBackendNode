import { Module } from '@nestjs/common';
import { PetsModule } from '../pets/pets.module';
import { PetGalleryController } from './pet-gallery.controller';
import { PetGalleryRepository } from './pet-gallery.repository';
import { PetGalleryService } from './pet-gallery.service';

@Module({
  imports: [PetsModule],
  controllers: [PetGalleryController],
  providers: [PetGalleryService, PetGalleryRepository],
  exports: [PetGalleryService, PetGalleryRepository],
})
export class PetGalleryModule {}
