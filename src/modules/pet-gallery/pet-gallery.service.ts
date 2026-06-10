import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PetGallery } from '@prisma/client';
import { UserRole } from '../../common/enums';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { PetRepository } from '../pets/pet.repository';
import { UploadGalleryImageDto } from './dto';
import { PetGalleryRepository } from './pet-gallery.repository';

const MAX_GALLERY_IMAGES = 20;

@Injectable()
export class PetGalleryService {
  private readonly logger = new Logger(PetGalleryService.name);

  constructor(
    private readonly galleryRepository: PetGalleryRepository,
    private readonly petRepository: PetRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async upload(
    petId: string,
    file: Express.Multer.File,
    dto: UploadGalleryImageDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<PetGallery> {
    const pet = await this.petRepository.findById(petId);
    if (!pet || pet.deletedAt) throw new NotFoundException('Pet not found');
    this.assertAccess(pet.ownerId, requesterId, requesterRole);

    const count = await this.galleryRepository.countByPet(petId);
    if (count >= MAX_GALLERY_IMAGES) {
      throw new BadRequestException(`Gallery limit reached (max ${MAX_GALLERY_IMAGES} images)`);
    }

    const { url, publicId } = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      'pawgo/pets/gallery',
      `pet_${petId}_${Date.now()}`,
    );

    const image = await this.galleryRepository.create({
      petId,
      imageUrl: url,
      publicId,
      caption: dto.caption,
      uploadedBy: requesterId,
    });

    this.logger.log(`Gallery image uploaded for pet ${petId}: ${image.id}`);
    return image;
  }

  async findByPet(
    petId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<PetGallery[]> {
    const pet = await this.petRepository.findById(petId);
    if (!pet || pet.deletedAt) throw new NotFoundException('Pet not found');
    this.assertAccess(pet.ownerId, requesterId, requesterRole);
    return this.galleryRepository.findByPet(petId);
  }

  async remove(
    imageId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<void> {
    const image = await this.galleryRepository.findById(imageId);
    if (!image) throw new NotFoundException('Gallery image not found');

    const pet = await this.petRepository.findById(image.petId);
    if (!pet) throw new NotFoundException('Pet not found');
    this.assertAccess(pet.ownerId, requesterId, requesterRole);

    await this.cloudinaryService.deleteByPublicId(image.publicId);
    await this.galleryRepository.delete(imageId);
    this.logger.log(`Gallery image deleted: ${imageId}`);
  }

  private assertAccess(ownerId: string, requesterId: string, role: string): void {
    if (role === UserRole.SUPER_ADMIN) return;
    if (ownerId === requesterId) return;
    throw new ForbiddenException('You do not have access to this pet');
  }
}
