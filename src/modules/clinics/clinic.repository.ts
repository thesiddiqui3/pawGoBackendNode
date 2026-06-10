import { Injectable } from '@nestjs/common';
import { Clinic, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { ClinicQueryDto } from './dto/clinic-query.dto';
import { NearbyClinicDto } from './dto/nearby-clinic.dto';

export type ClinicDetail = Clinic & {
  workingHours: {
    day: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }[];
  _count: { doctors: number; reviews: number };
};

export interface NearbyClinicRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  phone: string;
  rating: number;
  total_reviews: number;
  latitude: number;
  longitude: number;
  logo_url: string | null;
  is_verified: boolean;
  distance_km: number;
}

const ALLOWED_SORT = new Set(['name', 'rating', 'totalReviews', 'createdAt']);

@Injectable()
export class ClinicRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClinicDto, slug: string, createdBy: string): Promise<Clinic> {
    const { workingHours, ...rest } = dto;

    return this.prisma.clinic.create({
      data: {
        ...rest,
        slug,
        createdBy,
        services: dto.services ?? [],
        ...(workingHours?.length && {
          workingHours: {
            create: workingHours.map((wh) => ({
              day: wh.day,
              startTime: wh.startTime,
              endTime: wh.endTime,
              isAvailable: wh.isAvailable ?? true,
            })),
          },
        }),
      },
    });
  }

  async findById(id: string): Promise<ClinicDetail | null> {
    return this.prisma.clinic.findUnique({
      where: { id },
      include: {
        workingHours: { select: { day: true, startTime: true, endTime: true, isAvailable: true } },
        _count: { select: { doctors: true, reviews: true } },
      },
    }) as Promise<ClinicDetail | null>;
  }

  async findBySlug(slug: string): Promise<Clinic | null> {
    return this.prisma.clinic.findUnique({ where: { slug } });
  }

  async findMany(query: ClinicQueryDto): Promise<PaginatedResponseDto<Clinic>> {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const sortField = query.sortBy && ALLOWED_SORT.has(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const where: Prisma.ClinicWhereInput = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.verified !== undefined && { isVerified: query.verified }),
      ...(query.city && { city: { contains: query.city, mode: 'insensitive' } }),
      ...(query.state && { state: { contains: query.state, mode: 'insensitive' } }),
      ...(query.service && { services: { has: query.service } }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { city: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.clinic.findMany({ where, skip, take, orderBy: { [sortField]: sortOrder } }),
      this.prisma.clinic.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  // Haversine formula — no PostGIS required
  async findNearby(dto: NearbyClinicDto): Promise<NearbyClinicRow[]> {
    const { lat, lng, radius = 10, limit = 20 } = dto;
    return this.prisma.$queryRaw<NearbyClinicRow[]>`
      SELECT
        id,
        name,
        slug,
        city,
        address,
        phone,
        rating,
        total_reviews,
        latitude,
        longitude,
        logo_url,
        is_verified,
        (
          6371 * acos(
            LEAST(1.0,
              cos(radians(${lat})) * cos(radians(latitude))
              * cos(radians(longitude) - radians(${lng}))
              + sin(radians(${lat})) * sin(radians(latitude))
            )
          )
        ) AS distance_km
      FROM clinics
      WHERE
        latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND deleted_at IS NULL
        AND is_active = true
      HAVING distance_km <= ${radius}
      ORDER BY distance_km ASC
      LIMIT ${limit}
    `;
  }

  async update(id: string, dto: UpdateClinicDto, updatedBy: string): Promise<Clinic> {
    const { workingHours, ...rest } = dto;

    return this.prisma.clinic.update({
      where: { id },
      data: {
        ...rest,
        updatedBy,
        ...(workingHours !== undefined && {
          workingHours: {
            deleteMany: {},
            create: workingHours.map((wh) => ({
              day: wh.day,
              startTime: wh.startTime,
              endTime: wh.endTime,
              isAvailable: wh.isAvailable ?? true,
            })),
          },
        }),
      },
    });
  }

  async verify(id: string, updatedBy: string): Promise<Clinic> {
    return this.prisma.clinic.update({
      where: { id },
      data: { isVerified: true, updatedBy },
    });
  }

  async softDelete(id: string, updatedBy: string): Promise<Clinic> {
    return this.prisma.clinic.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date(), updatedBy },
    });
  }

  async updateLogo(id: string, logoUrl: string, logoPublicId: string, updatedBy: string): Promise<Clinic> {
    return this.prisma.clinic.update({ where: { id }, data: { logoUrl, logoPublicId, updatedBy } });
  }

  async updateBanner(id: string, bannerUrl: string, bannerPublicId: string, updatedBy: string): Promise<Clinic> {
    return this.prisma.clinic.update({ where: { id }, data: { bannerUrl, bannerPublicId, updatedBy } });
  }

  async updateRating(id: string, rating: number, totalReviews: number): Promise<void> {
    await this.prisma.clinic.update({ where: { id }, data: { rating, totalReviews } });
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return (await this.prisma.clinic.count({ where: { slug } })) > 0;
  }

  // Used to enforce one clinic per CLINIC_OWNER
  async findByCreatedBy(userId: string): Promise<ClinicDetail | null> {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: userId, deletedAt: null },
      include: {
        workingHours: { select: { day: true, startTime: true, endTime: true, isAvailable: true } },
        _count: { select: { doctors: true, reviews: true } },
      },
    });
    return clinic as ClinicDetail | null;
  }

  async existsByCreatedBy(userId: string): Promise<boolean> {
    return (await this.prisma.clinic.count({ where: { createdBy: userId, deletedAt: null } })) > 0;
  }

  // suspend / activate (toggle isActive without touching deletedAt)
  async setActive(id: string, isActive: boolean, updatedBy: string): Promise<Clinic> {
    return this.prisma.clinic.update({
      where: { id },
      data: { isActive, updatedBy },
    });
  }

  // List active doctors for a clinic (public)
  async findDoctors(clinicId: string) {
    return this.prisma.doctor.findMany({
      where: { clinicId, isActive: true },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        availability: { orderBy: { day: 'asc' } },
      },
      orderBy: { rating: 'desc' },
    });
  }
}
