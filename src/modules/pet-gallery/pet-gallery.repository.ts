import { Injectable } from '@nestjs/common';
import { PetGallery } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PetGalleryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    petId: string;
    imageUrl: string;
    publicId: string;
    caption?: string;
    uploadedBy: string;
  }): Promise<PetGallery> {
    return this.prisma.petGallery.create({ data });
  }

  async findByPet(petId: string): Promise<PetGallery[]> {
    return this.prisma.petGallery.findMany({
      where: { petId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async findById(id: string): Promise<PetGallery | null> {
    return this.prisma.petGallery.findUnique({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.petGallery.delete({ where: { id } });
  }

  async countByPet(petId: string): Promise<number> {
    return this.prisma.petGallery.count({ where: { petId } });
  }
}
