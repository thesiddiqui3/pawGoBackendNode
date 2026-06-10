import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceBookingStatus, ServiceCategory } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { BookingRepository } from '../booking.repository';
import { ServiceRepository } from '../service.repository';
import { ServicesService } from '../services.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockServiceRepo = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByClinicAndId: jest.fn(),
  findMany: jest.fn(),
  findByClinic: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
});

const mockBookingRepo = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findManyForCustomer: jest.fn(),
  findManyForClinic: jest.fn(),
  countSlotConflicts: jest.fn(),
  updateStatus: jest.fn(),
});

const mockPrisma = () => ({
  clinic: { findFirst: jest.fn() },
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CLINIC_ID = 'clinic-uuid';
const OWNER_ID = 'owner-uuid';
const SERVICE_ID = 'service-uuid';
const CUSTOMER_ID = 'customer-uuid';
const BOOKING_ID = 'booking-uuid';
const PET_ID = 'pet-uuid';

const makeService = (overrides: Record<string, unknown> = {}) => ({
  id: SERVICE_ID,
  name: 'Full Grooming',
  category: ServiceCategory.GROOMING,
  price: 499,
  duration: 90,
  maxPetsPerSlot: 1,
  isActive: true,
  clinic: { id: CLINIC_ID, name: 'Happy Paws Clinic', city: 'Mumbai' },
  ...overrides,
});

const makeBooking = (status: ServiceBookingStatus = ServiceBookingStatus.PENDING, overrides: Record<string, unknown> = {}) => ({
  id: BOOKING_ID,
  status,
  totalPrice: 499,
  scheduledAt: new Date(Date.now() + 86400000),
  service: { id: SERVICE_ID, name: 'Full Grooming', category: ServiceCategory.GROOMING, duration: 90, clinic: { id: CLINIC_ID } },
  pet: { id: PET_ID, name: 'Bruno' },
  customer: { id: CUSTOMER_ID, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ServicesService', () => {
  let service: ServicesService;
  let serviceRepo: ReturnType<typeof mockServiceRepo>;
  let bookingRepo: ReturnType<typeof mockBookingRepo>;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: ServiceRepository, useFactory: mockServiceRepo },
        { provide: BookingRepository, useFactory: mockBookingRepo },
        { provide: PrismaService, useFactory: mockPrisma },
      ],
    }).compile();

    service = module.get(ServicesService);
    serviceRepo = module.get(ServiceRepository) as unknown as ReturnType<typeof mockServiceRepo>;
    bookingRepo = module.get(BookingRepository) as unknown as ReturnType<typeof mockBookingRepo>;
    prisma = module.get(PrismaService) as unknown as ReturnType<typeof mockPrisma>;
  });

  // ─── createService ────────────────────────────────────────────────────────

  describe('createService', () => {
    const dto = { name: 'Bath & Brush', category: ServiceCategory.BATH, price: 299, duration: 60 };

    it('creates a service after resolving clinic', async () => {
      prisma.clinic.findFirst.mockResolvedValue({ id: CLINIC_ID });
      serviceRepo.create.mockResolvedValue(makeService());

      const result = await service.createService(dto, OWNER_ID);

      expect(prisma.clinic.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ createdBy: OWNER_ID }) }),
      );
      expect(serviceRepo.create).toHaveBeenCalledTimes(1);
      expect((result as any).id).toBe(SERVICE_ID);
    });

    it('throws NotFoundException when owner has no clinic', async () => {
      prisma.clinic.findFirst.mockResolvedValue(null);
      await expect(service.createService(dto, OWNER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getService ───────────────────────────────────────────────────────────

  describe('getService', () => {
    it('returns service when found', async () => {
      serviceRepo.findById.mockResolvedValue(makeService());
      const result = await service.getService(SERVICE_ID);
      expect((result as any).id).toBe(SERVICE_ID);
    });

    it('throws NotFoundException when not found', async () => {
      serviceRepo.findById.mockResolvedValue(null);
      await expect(service.getService('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateService ────────────────────────────────────────────────────────

  describe('updateService', () => {
    it('allows admin to update any service', async () => {
      serviceRepo.findById.mockResolvedValue(makeService());
      serviceRepo.update.mockResolvedValue(makeService({ price: 599 }));

      await service.updateService(SERVICE_ID, { price: 599 }, OWNER_ID, 'SUPER_ADMIN');
      expect(serviceRepo.update).toHaveBeenCalledWith(SERVICE_ID, { price: 599 });
    });

    it('throws ForbiddenException when clinic owner does not own the service', async () => {
      serviceRepo.findById.mockResolvedValue(makeService());
      prisma.clinic.findFirst.mockResolvedValue({ id: 'other-clinic-id' });
      serviceRepo.findByClinicAndId.mockResolvedValue(null);

      await expect(
        service.updateService(SERVICE_ID, { price: 599 }, OWNER_ID, 'CLINIC_OWNER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── deleteService ────────────────────────────────────────────────────────

  describe('deleteService', () => {
    it('soft-deletes when admin', async () => {
      serviceRepo.findById.mockResolvedValue(makeService());
      serviceRepo.softDelete.mockResolvedValue({});

      const result = await service.deleteService(SERVICE_ID, OWNER_ID, 'SUPER_ADMIN');
      expect(serviceRepo.softDelete).toHaveBeenCalledWith(SERVICE_ID);
      expect((result as any).message).toBe('Service deleted');
    });

    it('throws NotFoundException when service does not exist', async () => {
      serviceRepo.findById.mockResolvedValue(null);
      await expect(service.deleteService('bad-id', OWNER_ID, 'SUPER_ADMIN')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createBooking ────────────────────────────────────────────────────────

  describe('createBooking', () => {
    const dto = { serviceId: SERVICE_ID, petId: PET_ID, scheduledAt: new Date(Date.now() + 86400000).toISOString() };

    it('creates booking when slot is available', async () => {
      serviceRepo.findById.mockResolvedValue(makeService());
      bookingRepo.countSlotConflicts.mockResolvedValue(0);
      bookingRepo.create.mockResolvedValue(makeBooking());

      const result = await service.createBooking(dto, CUSTOMER_ID);
      expect(bookingRepo.create).toHaveBeenCalledTimes(1);
      expect((result as any).id).toBe(BOOKING_ID);
    });

    it('throws BadRequestException when slot is full', async () => {
      serviceRepo.findById.mockResolvedValue(makeService({ maxPetsPerSlot: 1 }));
      bookingRepo.countSlotConflicts.mockResolvedValue(1);

      await expect(service.createBooking(dto, CUSTOMER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for past scheduled time', async () => {
      serviceRepo.findById.mockResolvedValue(makeService());
      const pastDto = { ...dto, scheduledAt: new Date(Date.now() - 3600000).toISOString() };

      await expect(service.createBooking(pastDto, CUSTOMER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when service does not exist', async () => {
      serviceRepo.findById.mockResolvedValue(null);
      await expect(service.createBooking(dto, CUSTOMER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when service is inactive', async () => {
      serviceRepo.findById.mockResolvedValue(makeService({ isActive: false }));
      await expect(service.createBooking(dto, CUSTOMER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getBooking ───────────────────────────────────────────────────────────

  describe('getBooking', () => {
    it('returns booking to its owner', async () => {
      bookingRepo.findById.mockResolvedValue(makeBooking());
      const result = await service.getBooking(BOOKING_ID, CUSTOMER_ID, 'PET_OWNER');
      expect((result as any).id).toBe(BOOKING_ID);
    });

    it('throws ForbiddenException for a different user', async () => {
      bookingRepo.findById.mockResolvedValue(makeBooking());
      await expect(service.getBooking(BOOKING_ID, 'other-user', 'PET_OWNER')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── confirmBooking ───────────────────────────────────────────────────────

  describe('confirmBooking', () => {
    it('confirms a pending booking', async () => {
      bookingRepo.findById.mockResolvedValue(makeBooking(ServiceBookingStatus.PENDING));
      prisma.clinic.findFirst.mockResolvedValue({ id: CLINIC_ID });
      bookingRepo.updateStatus.mockResolvedValue(makeBooking(ServiceBookingStatus.CONFIRMED));

      await service.confirmBooking(BOOKING_ID, OWNER_ID, 'CLINIC_OWNER');
      expect(bookingRepo.updateStatus).toHaveBeenCalledWith(
        BOOKING_ID,
        expect.objectContaining({ status: ServiceBookingStatus.CONFIRMED }),
      );
    });

    it('throws BadRequestException when booking is not PENDING', async () => {
      bookingRepo.findById.mockResolvedValue(makeBooking(ServiceBookingStatus.CONFIRMED));
      prisma.clinic.findFirst.mockResolvedValue({ id: CLINIC_ID });

      await expect(service.confirmBooking(BOOKING_ID, OWNER_ID, 'CLINIC_OWNER')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancelBooking ────────────────────────────────────────────────────────

  describe('cancelBooking', () => {
    it('customer can cancel a pending booking', async () => {
      bookingRepo.findById.mockResolvedValue(makeBooking(ServiceBookingStatus.PENDING));
      bookingRepo.updateStatus.mockResolvedValue(makeBooking(ServiceBookingStatus.CANCELLED));

      await service.cancelBooking(BOOKING_ID, CUSTOMER_ID, 'PET_OWNER', 'Changed plans');
      expect(bookingRepo.updateStatus).toHaveBeenCalledWith(
        BOOKING_ID,
        expect.objectContaining({ status: ServiceBookingStatus.CANCELLED }),
      );
    });

    it('throws BadRequestException when cancelling a completed booking', async () => {
      bookingRepo.findById.mockResolvedValue(makeBooking(ServiceBookingStatus.COMPLETED));

      await expect(
        service.cancelBooking(BOOKING_ID, CUSTOMER_ID, 'PET_OWNER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException for a non-owner non-admin', async () => {
      bookingRepo.findById.mockResolvedValue(makeBooking(ServiceBookingStatus.PENDING));

      await expect(
        service.cancelBooking(BOOKING_ID, 'stranger-id', 'PET_OWNER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
