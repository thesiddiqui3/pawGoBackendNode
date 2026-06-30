import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceBookingStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { BookingRepository } from './booking.repository';
import { ServiceRepository } from './service.repository';
import {
  BookingQueryDto,
  CreateBookingDto,
  CreateServiceDto,
  ServiceQueryDto,
  UpdateServiceDto,
} from './dto';

@Injectable()
export class ServicesService {
  constructor(
    private readonly serviceRepo: ServiceRepository,
    private readonly bookingRepo: BookingRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async resolveClinicId(ownerId: string): Promise<string> {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('You do not have a clinic');
    return clinic.id;
  }

  private isAdmin(role: string) {
    return role === UserRole.SUPER_ADMIN;
  }

  // ─── Service CRUD ─────────────────────────────────────────────────────────

  async createService(dto: CreateServiceDto, ownerId: string) {
    const clinicId = await this.resolveClinicId(ownerId);
    return this.serviceRepo.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      price: dto.price,
      duration: dto.duration,
      maxPetsPerSlot: dto.maxPetsPerSlot ?? 1,
      clinic: { connect: { id: clinicId } },
      createdBy: ownerId,
    });
  }

  async listServices(query: ServiceQueryDto) {
    return this.serviceRepo.findMany(query);
  }

  async getService(id: string) {
    const service = await this.serviceRepo.findById(id);
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async listClinicServices(clinicId: string, includeInactive = false) {
    return this.serviceRepo.findByClinic(clinicId, includeInactive);
  }

  async myClinicServices(ownerId: string) {
    const clinicId = await this.resolveClinicId(ownerId);
    return this.serviceRepo.findByClinic(clinicId, true);
  }

  async updateService(id: string, dto: UpdateServiceDto, ownerId: string, role: string) {
    const service = await this.serviceRepo.findById(id);
    if (!service) throw new NotFoundException('Service not found');

    if (!this.isAdmin(role)) {
      const clinicId = await this.resolveClinicId(ownerId);
      const owned = await this.serviceRepo.findByClinicAndId(id, clinicId);
      if (!owned) throw new ForbiddenException('You do not own this service');
    }

    return this.serviceRepo.update(id, { ...dto });
  }

  async deleteService(id: string, ownerId: string, role: string) {
    const service = await this.serviceRepo.findById(id);
    if (!service) throw new NotFoundException('Service not found');

    if (!this.isAdmin(role)) {
      const clinicId = await this.resolveClinicId(ownerId);
      const owned = await this.serviceRepo.findByClinicAndId(id, clinicId);
      if (!owned) throw new ForbiddenException('You do not own this service');
    }

    await this.serviceRepo.softDelete(id);
    return { message: 'Service deleted' };
  }

  // ─── Booking ──────────────────────────────────────────────────────────────

  async createBooking(dto: CreateBookingDto, customerId: string) {
    const service = await this.serviceRepo.findById(dto.serviceId);
    if (!service) throw new NotFoundException('Service not found');
    if (!service.isActive) throw new BadRequestException('Service is not available');

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) throw new BadRequestException('Scheduled time must be in the future');

    const conflicts = await this.bookingRepo.countSlotConflicts(dto.serviceId, scheduledAt, service.maxPetsPerSlot);
    if (conflicts >= service.maxPetsPerSlot) {
      throw new BadRequestException('This time slot is fully booked');
    }

    return this.bookingRepo.create({
      service: { connect: { id: dto.serviceId } },
      pet: { connect: { id: dto.petId } },
      customer: { connect: { id: customerId } },
      scheduledAt,
      notes: dto.notes,
      totalPrice: service.price,
    });
  }

  async getBooking(id: string, userId: string, role: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    if (!this.isAdmin(role) && booking.customer.id !== userId) throw new ForbiddenException('Access denied');
    return booking;
  }

  async myBookings(customerId: string, query: BookingQueryDto) {
    return this.bookingRepo.findManyForCustomer(customerId, query);
  }

  async clinicBookings(ownerId: string, query: BookingQueryDto) {
    const clinicId = await this.resolveClinicId(ownerId);
    return this.bookingRepo.findManyForClinic(clinicId, query);
  }

  async shopBookings(ownerId: string, query: BookingQueryDto) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId } });
    if (!shop) throw new NotFoundException('Shop not found');
    return this.bookingRepo.findManyForShop(shop.id, query);
  }

  async shopConfirmBooking(id: string, ownerId: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    const shop = await this.prisma.shop.findUnique({ where: { ownerId } });
    if (!shop || booking.service.shopId !== shop.id) throw new ForbiddenException('Access denied');
    if (booking.status !== ServiceBookingStatus.PENDING) throw new BadRequestException(`Cannot confirm a ${booking.status} booking`);
    return this.bookingRepo.updateStatus(id, { status: ServiceBookingStatus.CONFIRMED, confirmedAt: new Date() });
  }

  async shopStartBooking(id: string, ownerId: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    const shop = await this.prisma.shop.findUnique({ where: { ownerId } });
    if (!shop || booking.service.shopId !== shop.id) throw new ForbiddenException('Access denied');
    if (booking.status !== ServiceBookingStatus.CONFIRMED) throw new BadRequestException(`Cannot start a ${booking.status} booking`);
    return this.bookingRepo.updateStatus(id, { status: ServiceBookingStatus.IN_PROGRESS });
  }

  async shopCompleteBooking(id: string, ownerId: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    const shop = await this.prisma.shop.findUnique({ where: { ownerId } });
    if (!shop || booking.service.shopId !== shop.id) throw new ForbiddenException('Access denied');
    if (booking.status !== ServiceBookingStatus.IN_PROGRESS) throw new BadRequestException(`Cannot complete a ${booking.status} booking`);
    return this.bookingRepo.updateStatus(id, { status: ServiceBookingStatus.COMPLETED, completedAt: new Date() });
  }

  async shopCancelBooking(id: string, ownerId: string, reason?: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    const shop = await this.prisma.shop.findUnique({ where: { ownerId } });
    if (!shop || booking.service.shopId !== shop.id) throw new ForbiddenException('Access denied');
    const cancellable: ServiceBookingStatus[] = [ServiceBookingStatus.PENDING, ServiceBookingStatus.CONFIRMED];
    if (!cancellable.includes(booking.status)) throw new BadRequestException(`Cannot cancel a ${booking.status} booking`);
    return this.bookingRepo.updateStatus(id, { status: ServiceBookingStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason });
  }

  async confirmBooking(id: string, ownerId: string, role: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    if (!this.isAdmin(role)) {
      const clinicId = await this.resolveClinicId(ownerId);
      if (booking.service.clinic?.id !== clinicId) throw new ForbiddenException('Access denied');
    }

    if (booking.status !== ServiceBookingStatus.PENDING) {
      throw new BadRequestException(`Cannot confirm a booking in '${booking.status}' status`);
    }

    return this.bookingRepo.updateStatus(id, { status: ServiceBookingStatus.CONFIRMED, confirmedAt: new Date() });
  }

  async startBooking(id: string, ownerId: string, role: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    if (!this.isAdmin(role)) {
      const clinicId = await this.resolveClinicId(ownerId);
      if (booking.service.clinic?.id !== clinicId) throw new ForbiddenException('Access denied');
    }

    if (booking.status !== ServiceBookingStatus.CONFIRMED) {
      throw new BadRequestException(`Cannot start a booking in '${booking.status}' status`);
    }

    return this.bookingRepo.updateStatus(id, { status: ServiceBookingStatus.IN_PROGRESS });
  }

  async completeBooking(id: string, ownerId: string, role: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    if (!this.isAdmin(role)) {
      const clinicId = await this.resolveClinicId(ownerId);
      if (booking.service.clinic?.id !== clinicId) throw new ForbiddenException('Access denied');
    }

    if (booking.status !== ServiceBookingStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot complete a booking in '${booking.status}' status`);
    }

    return this.bookingRepo.updateStatus(id, { status: ServiceBookingStatus.COMPLETED, completedAt: new Date() });
  }

  async cancelBooking(id: string, userId: string, role: string, reason?: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    if (!this.isAdmin(role) && booking.customer.id !== userId) throw new ForbiddenException('Access denied');

    const cancellable: ServiceBookingStatus[] = [ServiceBookingStatus.PENDING, ServiceBookingStatus.CONFIRMED];
    if (!cancellable.includes(booking.status)) {
      throw new BadRequestException(`Cannot cancel a booking in '${booking.status}' status`);
    }

    return this.bookingRepo.updateStatus(id, {
      status: ServiceBookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason ?? null,
    });
  }

  async markNoShow(id: string, ownerId: string, role: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    if (!this.isAdmin(role)) {
      const clinicId = await this.resolveClinicId(ownerId);
      if (booking.service.clinic?.id !== clinicId) throw new ForbiddenException('Access denied');
    }

    if (booking.status !== ServiceBookingStatus.CONFIRMED) {
      throw new BadRequestException(`Cannot mark no-show for a booking in '${booking.status}' status`);
    }

    return this.bookingRepo.updateStatus(id, { status: ServiceBookingStatus.NO_SHOW, noShowAt: new Date() });
  }
}
