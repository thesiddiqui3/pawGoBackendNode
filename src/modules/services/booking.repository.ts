import { Injectable } from '@nestjs/common';
import { Prisma, ServiceBookingStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { BookingQueryDto } from './dto';

const BOOKING_SELECT = {
  id: true,
  scheduledAt: true,
  status: true,
  notes: true,
  totalPrice: true,
  confirmedAt: true,
  cancelledAt: true,
  completedAt: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  service: {
    select: {
      id: true,
      name: true,
      category: true,
      duration: true,
      imageUrl: true,
      clinic: { select: { id: true, name: true, city: true } },
      shop: { select: { id: true, name: true } },
      shopId: true,
    },
  },
  pet: { select: { id: true, name: true, species: true, breed: true, photoUrl: true } },
  customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
} satisfies Prisma.ServiceBookingSelect;

@Injectable()
export class BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ServiceBookingCreateInput) {
    return this.prisma.serviceBooking.create({ data, select: BOOKING_SELECT });
  }

  async findById(id: string) {
    return this.prisma.serviceBooking.findUnique({ where: { id }, select: BOOKING_SELECT });
  }

  async findManyForCustomer(customerId: string, query: BookingQueryDto) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const where: Prisma.ServiceBookingWhereInput = {
      customerId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceBooking.findMany({ where, select: BOOKING_SELECT, skip, take, orderBy: { scheduledAt: 'desc' } }),
      this.prisma.serviceBooking.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async findManyForShop(shopId: string, query: BookingQueryDto) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const where: Prisma.ServiceBookingWhereInput = {
      service: { shopId },
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceBooking.findMany({ where, select: BOOKING_SELECT, skip, take, orderBy: { scheduledAt: 'desc' } }),
      this.prisma.serviceBooking.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async findManyForClinic(clinicId: string, query: BookingQueryDto) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const where: Prisma.ServiceBookingWhereInput = {
      service: { clinicId },
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceBooking.findMany({ where, select: BOOKING_SELECT, skip, take, orderBy: { scheduledAt: 'desc' } }),
      this.prisma.serviceBooking.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async findAll(query: BookingQueryDto & { clinicId?: string }) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const where: Prisma.ServiceBookingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.clinicId ? { service: { clinicId: query.clinicId } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceBooking.findMany({ where, select: BOOKING_SELECT, skip, take, orderBy: { scheduledAt: 'desc' } }),
      this.prisma.serviceBooking.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async countSlotConflicts(serviceId: string, scheduledAt: Date, maxPetsPerSlot: number, excludeId?: string): Promise<number> {
    return this.prisma.serviceBooking.count({
      where: {
        serviceId,
        scheduledAt,
        status: { notIn: [ServiceBookingStatus.CANCELLED, ServiceBookingStatus.NO_SHOW] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async updateStatus(id: string, data: Prisma.ServiceBookingUpdateInput) {
    return this.prisma.serviceBooking.update({ where: { id }, data, select: BOOKING_SELECT });
  }
}
