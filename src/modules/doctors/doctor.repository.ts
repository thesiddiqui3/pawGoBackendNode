import { Injectable } from '@nestjs/common';
import { Doctor, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorQueryDto } from './dto/doctor-query.dto';

const INCLUDE_FULL = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
  clinic: { select: { id: true, name: true, slug: true, city: true, address: true } },
  availability: true,
  education: true,
  certifications: true,
} satisfies Prisma.DoctorInclude;

const ALLOWED_SORT = new Set(['rating', 'experienceYears', 'consultationFee', 'createdAt']);

@Injectable()
export class DoctorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDoctorDto): Promise<Doctor> {
    return this.prisma.doctor.create({
      data: {
        userId: dto.userId!,
        clinicId: dto.clinicId,
        specializations: dto.specializations,
        experienceYears: dto.experienceYears ?? 0,
        consultationFee: dto.consultationFee,
        bio: dto.bio,
        languages: dto.languages ?? [],
        ...(Array.isArray(dto.availability) && dto.availability.length && {
          availability: { create: (dto.availability as import('./dto/availability.dto').AvailabilityDto[]).map((a) => ({ ...a, isAvailable: a.isAvailable ?? true })) },
        }),
        ...(dto.education?.length && {
          education: { create: dto.education },
        }),
        ...(dto.certifications?.length && {
          certifications: { create: dto.certifications },
        }),
      },
      include: INCLUDE_FULL,
    });
  }

  async findById(id: string) {
    return this.prisma.doctor.findUnique({ where: { id }, include: INCLUDE_FULL });
  }

  async findByUserId(userId: string) {
    return this.prisma.doctor.findUnique({ where: { userId }, include: INCLUDE_FULL });
  }

  async findMany(query: DoctorQueryDto): Promise<PaginatedResponseDto<object>> {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const sortField = query.sortBy && ALLOWED_SORT.has(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const where: Prisma.DoctorWhereInput = {
      // If querying for a specific clinic (owner view), show all doctors (active + inactive)
      // Public listings always filter to active only
      ...(query.clinicId ? {} : { isActive: true }),
      ...(query.verified !== undefined && { isVerified: query.verified }),
      ...(query.clinicId && { clinicId: query.clinicId }),
      ...(query.specialization && { specializations: { has: query.specialization } }),
      ...(query.city && {
        clinic: { city: { contains: query.city, mode: 'insensitive' } },
      }),
      ...(query.search && {
        OR: [
          { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
          { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
          { bio: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.doctor.findMany({ where, skip, take, orderBy: { [sortField]: sortOrder }, include: INCLUDE_FULL }),
      this.prisma.doctor.count({ where }),
    ]);

    return buildPaginatedResponse(items as object[], total, page, pageSize);
  }

  async update(id: string, dto: UpdateDoctorDto): Promise<Doctor> {
    return this.prisma.doctor.update({
      where: { id },
      data: {
        ...(dto.clinicId !== undefined && { clinicId: dto.clinicId }),
        ...(dto.specializations && { specializations: dto.specializations }),
        ...(dto.experienceYears !== undefined && { experienceYears: dto.experienceYears }),
        ...(dto.consultationFee !== undefined && { consultationFee: dto.consultationFee }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.languages && { languages: dto.languages }),
        ...(dto.availability && {
          availability: {
            deleteMany: {},
            create: dto.availability.map((a) => ({ ...a, isAvailable: a.isAvailable ?? true })),
          },
        }),
        ...(dto.education && {
          education: { deleteMany: {}, create: dto.education },
        }),
        ...(dto.certifications && {
          certifications: { deleteMany: {}, create: dto.certifications },
        }),
      },
      include: INCLUDE_FULL,
    });
  }

  async updatePhoto(id: string, photoUrl: string, photoPublicId: string): Promise<Doctor> {
    return this.prisma.doctor.update({ where: { id }, data: { photoUrl, photoPublicId } });
  }

  async verify(id: string): Promise<Doctor> {
    return this.prisma.doctor.update({ where: { id }, data: { isVerified: true } });
  }

  async updateRating(id: string, rating: number, totalReviews: number): Promise<void> {
    await this.prisma.doctor.update({ where: { id }, data: { rating, totalReviews } });
  }

  async existsByUserId(userId: string): Promise<boolean> {
    return (await this.prisma.doctor.count({ where: { userId } })) > 0;
  }

  async findByClinic(clinicId: string, includeInactive = false) {
    return this.prisma.doctor.findMany({
      where: { clinicId, ...(!includeInactive && { isActive: true }) },
      include: INCLUDE_FULL,
      orderBy: { rating: 'desc' },
    });
  }

  async deactivate(id: string): Promise<Doctor> {
    return this.prisma.doctor.update({ where: { id }, data: { isActive: false } });
  }

  async activate(id: string): Promise<Doctor> {
    return this.prisma.doctor.update({ where: { id }, data: { isActive: true }, include: INCLUDE_FULL });
  }

  async upsertAvailability(
    doctorId: string,
    day: string,
    data: { startTime: string; endTime: string; isAvailable?: boolean },
  ) {
    return this.prisma.doctorAvailability.upsert({
      where: { doctorId_day: { doctorId, day: day as any } },
      update: { startTime: data.startTime, endTime: data.endTime, isAvailable: data.isAvailable ?? true },
      create: { doctorId, day: day as any, startTime: data.startTime, endTime: data.endTime, isAvailable: data.isAvailable ?? true },
    });
  }

  async deleteAvailability(doctorId: string, day: string): Promise<void> {
    await this.prisma.doctorAvailability.deleteMany({
      where: { doctorId, day: day as any },
    });
  }

  async getAvailability(doctorId: string) {
    return this.prisma.doctorAvailability.findMany({
      where: { doctorId },
      orderBy: { day: 'asc' },
    });
  }
}
