import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Pet } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { ConfigService } from '@nestjs/config';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetQueryDto } from './dto/pet-query.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { PetRepository, PetWithOwner } from './pet.repository';

@Injectable()
export class PetsService {
  private readonly logger = new Logger(PetsService.name);

  constructor(
    private readonly petRepository: PetRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(ownerId: string, dto: CreatePetDto): Promise<Pet> {
    if (dto.microchipNumber) {
      const exists = await this.petRepository.existsByMicrochip(dto.microchipNumber);
      if (exists) {
        throw new ConflictException(
          `A pet with microchip number '${dto.microchipNumber}' is already registered`,
        );
      }
    }

    const pet = await this.petRepository.create(ownerId, dto, ownerId);
    this.logger.log(`Pet created: ${pet.id} by owner ${ownerId}`);
    return pet;
  }

  // ─── Get My Pets ──────────────────────────────────────────────────────────

  async findMyPets(ownerId: string, query: PetQueryDto): Promise<PaginatedResponseDto<Pet>> {
    return this.petRepository.findManyByOwner(ownerId, query);
  }

  // ─── Get Single Pet ───────────────────────────────────────────────────────

  async findOne(petId: string, requesterId: string, requesterRole: string): Promise<PetWithOwner> {
    const pet = await this.petRepository.findById(petId);

    if (!pet || pet.deletedAt) {
      throw new NotFoundException('Pet not found');
    }

    this.assertAccess(pet.ownerId, requesterId, requesterRole, 'view');
    return pet;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(
    petId: string,
    dto: UpdatePetDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<Pet> {
    const pet = await this.findOwnedOrThrow(petId, requesterId, requesterRole, 'update');

    if (dto.microchipNumber && dto.microchipNumber !== pet.microchipNumber) {
      const conflict = await this.petRepository.existsByMicrochip(dto.microchipNumber, petId);
      if (conflict) {
        throw new ConflictException(
          `A pet with microchip number '${dto.microchipNumber}' is already registered`,
        );
      }
    }

    const updated = await this.petRepository.update(petId, dto, requesterId);
    this.logger.log(`Pet updated: ${petId} by ${requesterId}`);
    return updated;
  }

  // ─── Delete (soft) ────────────────────────────────────────────────────────

  async remove(petId: string, requesterId: string, requesterRole: string): Promise<void> {
    const pet = await this.findOwnedOrThrow(petId, requesterId, requesterRole, 'delete');

    // Delete photo from Cloudinary on pet deletion
    if (pet.photoPublicId) {
      await this.cloudinaryService.deleteByPublicId(pet.photoPublicId);
    }

    await this.petRepository.softDelete(petId, requesterId);
    this.logger.log(`Pet soft-deleted: ${petId} by ${requesterId}`);
  }

  // ─── Upload Photo ─────────────────────────────────────────────────────────

  async uploadPhoto(
    petId: string,
    file: Express.Multer.File,
    requesterId: string,
    requesterRole: string,
  ): Promise<Pet> {
    const pet = await this.findOwnedOrThrow(petId, requesterId, requesterRole, 'update');

    // Replace old photo
    if (pet.photoPublicId) {
      await this.cloudinaryService.deleteByPublicId(pet.photoPublicId);
    }

    const folder = this.configService.get<string>('cloudinary.avatarFolder', 'pawgo/pets');
    const { url, publicId } = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      folder,
      `pet_${petId}`,
      [{ width: 400, height: 400, crop: 'fill', gravity: 'auto' }],
    );

    const updated = await this.petRepository.updatePhoto(petId, url, publicId, requesterId);
    this.logger.log(`Photo uploaded for pet: ${petId}`);
    return updated;
  }

  // ─── Delete Photo ─────────────────────────────────────────────────────────

  async removePhoto(petId: string, requesterId: string, requesterRole: string): Promise<Pet> {
    const pet = await this.findOwnedOrThrow(petId, requesterId, requesterRole, 'update');

    if (pet.photoPublicId) {
      await this.cloudinaryService.deleteByPublicId(pet.photoPublicId);
    }

    return this.petRepository.removePhoto(petId, requesterId);
  }

  // ─── Dashboard Stats ──────────────────────────────────────────────────────

  async getDashboard(ownerId: string): Promise<object> {
    return this.petRepository.getDashboardStats(ownerId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private assertAccess(
    ownerId: string,
    requesterId: string,
    requesterRole: string,
    action: string,
  ): void {
    const isOwner = ownerId === requesterId;
    const isAdmin =
      requesterRole === UserRole.SUPER_ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        `You do not have permission to ${action} this pet`,
      );
    }
  }

  private async findOwnedOrThrow(
    petId: string,
    requesterId: string,
    requesterRole: string,
    action: string,
  ): Promise<Pet> {
    const pet = await this.petRepository.findById(petId);

    if (!pet || pet.deletedAt) {
      throw new NotFoundException('Pet not found');
    }

    this.assertAccess(pet.ownerId, requesterId, requesterRole, action);
    return pet;
  }
}
