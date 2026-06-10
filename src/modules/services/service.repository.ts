import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { ServiceQueryDto } from './dto';

const SERVICE_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  price: true,
  duration: true,
  maxPetsPerSlot: true,
  isActive: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  clinic: {
    select: { id: true, name: true, slug: true, city: true, state: true, logoUrl: true, rating: true },
  },
} satisfies Prisma.PetServiceSelect;

@Injectable()
export class ServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.PetServiceCreateInput) {
    return this.prisma.petService.create({ data, select: SERVICE_SELECT });
  }

  async findById(id: string) {
    return this.prisma.petService.findFirst({
      where: { id, deletedAt: null },
      select: SERVICE_SELECT,
    });
  }

  async findByClinicAndId(id: string, clinicId: string) {
    return this.prisma.petService.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
  }

  async findMany(query: ServiceQueryDto) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    const where: Prisma.PetServiceWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(query.clinicId ? { clinicId: query.clinicId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? { price: { ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.petService.findMany({ where, select: SERVICE_SELECT, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.petService.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async findAllAdmin(query: ServiceQueryDto) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const where: Prisma.PetServiceWhereInput = {
      deletedAt: null,
      ...(query.clinicId ? { clinicId: query.clinicId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.petService.findMany({ where, select: SERVICE_SELECT, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.petService.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async findByClinic(clinicId: string, includeInactive = false) {
    return this.prisma.petService.findMany({
      where: { clinicId, deletedAt: null, ...(!includeInactive ? { isActive: true } : {}) },
      select: SERVICE_SELECT,
      orderBy: { category: 'asc' },
    });
  }

  async update(id: string, data: Prisma.PetServiceUpdateInput) {
    return this.prisma.petService.update({ where: { id }, data, select: SERVICE_SELECT });
  }

  async softDelete(id: string) {
    return this.prisma.petService.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
