import { Injectable } from '@nestjs/common';
import { Pet, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { PetQueryDto } from './dto/pet-query.dto';

export type PetWithOwner = Pet & {
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
};

const OWNER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class PetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreatePetDto, createdBy: string): Promise<Pet> {
    return this.prisma.pet.create({
      data: {
        ownerId,
        createdBy,
        name: dto.name,
        species: dto.species,
        breed: dto.breed,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth,
        weight: dto.weight,
        color: dto.color,
        microchipNumber: dto.microchipNumber,
        notes: dto.notes,
      },
    });
  }

  async findById(id: string): Promise<PetWithOwner | null> {
    return this.prisma.pet.findUnique({
      where: { id },
      include: { owner: { select: OWNER_SELECT } },
    }) as Promise<PetWithOwner | null>;
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<Pet | null> {
    return this.prisma.pet.findFirst({
      where: { id, ownerId, deletedAt: null },
    });
  }

  async findManyByOwner(
    ownerId: string,
    query: PetQueryDto,
  ): Promise<PaginatedResponseDto<Pet>> {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    const allowedSortFields = new Set(['name', 'createdAt', 'updatedAt', 'species', 'breed']);
    const sortField = query.sortBy && allowedSortFields.has(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const where: Prisma.PetWhereInput = {
      ownerId,
      deletedAt: null,
      isActive: true,
      ...(query.species && { species: query.species }),
      ...(query.gender && { gender: query.gender }),
      ...(query.breed && {
        breed: { contains: query.breed, mode: 'insensitive' },
      }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { breed: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.pet.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: sortOrder },
      }),
      this.prisma.pet.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async update(id: string, dto: UpdatePetDto, updatedBy: string): Promise<Pet> {
    return this.prisma.pet.update({
      where: { id },
      data: {
        updatedBy,
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.breed !== undefined && { breed: dto.breed }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.microchipNumber !== undefined && { microchipNumber: dto.microchipNumber }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async updatePhoto(
    id: string,
    photoUrl: string,
    photoPublicId: string,
    updatedBy: string,
  ): Promise<Pet> {
    return this.prisma.pet.update({
      where: { id },
      data: { photoUrl, photoPublicId, updatedBy },
    });
  }

  async removePhoto(id: string, updatedBy: string): Promise<Pet> {
    return this.prisma.pet.update({
      where: { id },
      data: { photoUrl: null, photoPublicId: null, updatedBy },
    });
  }

  async softDelete(id: string, updatedBy: string): Promise<Pet> {
    return this.prisma.pet.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date(), updatedBy },
    });
  }

  async getDashboardStats(ownerId: string): Promise<{
    totalPets: number;
    bySpecies: Record<string, number>;
    upcomingVaccinations: number;
    medicalRecords: number;
  }> {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [pets, upcomingVaccinations, medicalRecords] = await this.prisma.$transaction([
      this.prisma.pet.findMany({
        where: { ownerId, deletedAt: null, isActive: true },
        select: { species: true },
      }),
      this.prisma.vaccination.count({
        where: {
          pet: { ownerId },
          nextDueDate: { gte: now, lte: in30Days },
        },
      }),
      this.prisma.medicalRecord.count({
        where: { pet: { ownerId } },
      }),
    ]);

    const bySpecies: Record<string, number> = {};
    for (const pet of pets) {
      bySpecies[pet.species] = (bySpecies[pet.species] ?? 0) + 1;
    }

    return {
      totalPets: pets.length,
      bySpecies,
      upcomingVaccinations,
      medicalRecords,
    };
  }

  async existsByMicrochip(microchipNumber: string, excludeId?: string): Promise<boolean> {
    const count = await this.prisma.pet.count({
      where: {
        microchipNumber,
        deletedAt: null,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return count > 0;
  }
}
