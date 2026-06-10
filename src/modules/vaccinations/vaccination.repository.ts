import { Injectable } from '@nestjs/common';
import { Prisma, Vaccination } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PrismaService } from '../../database/prisma.service';
import { VaccinationQueryDto } from './dto/vaccination-query.dto';

const VACCINATION_INCLUDE = {
  pet: { select: { id: true, name: true, species: true, breed: true, ownerId: true } },
  doctor: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  clinic: { select: { id: true, name: true, city: true } },
  reminders: { orderBy: { scheduledFor: 'asc' as const } },
} satisfies Prisma.VaccinationInclude;

export type VaccinationDetail = Prisma.VaccinationGetPayload<{
  include: typeof VACCINATION_INCLUDE;
}>;

@Injectable()
export class VaccinationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.VaccinationCreateInput): Promise<VaccinationDetail> {
    return this.prisma.vaccination.create({ data, include: VACCINATION_INCLUDE });
  }

  async findById(id: string): Promise<VaccinationDetail | null> {
    return this.prisma.vaccination.findUnique({ where: { id }, include: VACCINATION_INCLUDE });
  }

  async findRaw(id: string): Promise<Vaccination | null> {
    return this.prisma.vaccination.findUnique({ where: { id } });
  }

  async findMany(query: VaccinationQueryDto): Promise<PaginatedResponseDto<VaccinationDetail>> {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const where: Prisma.VaccinationWhereInput = {
      ...(query.petId && { petId: query.petId }),
      ...(query.vaccineName && {
        vaccineName: { contains: query.vaccineName, mode: 'insensitive' },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vaccination.findMany({
        where,
        skip,
        take,
        orderBy: { dateAdministered: 'desc' },
        include: VACCINATION_INCLUDE,
      }),
      this.prisma.vaccination.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async findByPet(petId: string): Promise<VaccinationDetail[]> {
    return this.prisma.vaccination.findMany({
      where: { petId },
      orderBy: { dateAdministered: 'desc' },
      include: VACCINATION_INCLUDE,
    });
  }

  async findUpcoming(
    daysAhead: number,
    petId?: string,
  ): Promise<VaccinationDetail[]> {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 86_400_000);
    return this.prisma.vaccination.findMany({
      where: {
        nextDueDate: { gte: now, lte: future },
        ...(petId && { petId }),
      },
      orderBy: { nextDueDate: 'asc' },
      include: VACCINATION_INCLUDE,
    });
  }

  async findLastVaccination(petId: string): Promise<VaccinationDetail | null> {
    const items = await this.prisma.vaccination.findMany({
      where: { petId },
      orderBy: { dateAdministered: 'desc' },
      take: 1,
      include: VACCINATION_INCLUDE,
    });
    return items[0] ?? null;
  }

  async update(id: string, data: Prisma.VaccinationUpdateInput): Promise<VaccinationDetail> {
    return this.prisma.vaccination.update({ where: { id }, data, include: VACCINATION_INCLUDE });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vaccination.delete({ where: { id } });
  }

  async createReminders(
    data: Prisma.VaccinationReminderCreateManyInput[],
  ): Promise<void> {
    await this.prisma.vaccinationReminder.createMany({ data, skipDuplicates: true });
  }

  async findReminders(
    where: Prisma.VaccinationReminderWhereInput,
  ) {
    return this.prisma.vaccinationReminder.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
      include: {
        pet: { select: { id: true, name: true } },
        vaccination: { select: { id: true, vaccineName: true, nextDueDate: true } },
      },
    });
  }

  async updateReminderStatus(id: string, status: string): Promise<void> {
    await this.prisma.vaccinationReminder.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
