import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryPartnerRepository } from '../delivery-partner.repository';
import { DeliveryPartnersService } from '../delivery-partners.service';
import { VehicleType } from '@prisma/client';

const mockRepo = () => ({
  create: jest.fn(),
  findByUserId: jest.fn(),
  findById: jest.fn(),
  existsByUserId: jest.fn(),
  update: jest.fn(),
  findMany: jest.fn(),
  findAvailablePartners: jest.fn(),
  incrementDeliveries: jest.fn(),
  updateRating: jest.fn(),
});

const mockEmitter = () => ({ emit: jest.fn() });

const makePartner = (overrides: Record<string, unknown> = {}) => ({
  id: 'partner-uuid',
  userId: 'user-id',
  vehicleType: VehicleType.BIKE,
  vehicleNumber: 'MH01AB1234',
  drivingLicense: 'DL-12345',
  aadhaarNumber: '123456789012',
  emergencyContact: '+919876543210',
  isApproved: true,
  isAvailable: true,
  isOnline: false,
  averageRating: 4.5,
  totalRatings: 10,
  totalDeliveries: 25,
  totalEarnings: 1250,
  currentLat: 28.61,
  currentLng: 77.21,
  user: { id: 'user-id', firstName: 'Rahul', lastName: 'Kumar', email: 'rahul@test.com', phone: '+91' },
  ...overrides,
});

describe('DeliveryPartnersService', () => {
  let service: DeliveryPartnersService;
  let repo: ReturnType<typeof mockRepo>;
  let emitter: ReturnType<typeof mockEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryPartnersService,
        { provide: DeliveryPartnerRepository, useFactory: mockRepo },
        { provide: EventEmitter2, useFactory: mockEmitter },
      ],
    }).compile();

    service = module.get(DeliveryPartnersService);
    repo = module.get(DeliveryPartnerRepository) as unknown as ReturnType<typeof mockRepo>;
    emitter = module.get(EventEmitter2) as unknown as ReturnType<typeof mockEmitter>;
  });

  describe('register', () => {
    const dto = {
      vehicleType: VehicleType.BIKE,
      vehicleNumber: 'MH01AB1234',
      drivingLicense: 'DL-123',
      aadhaarNumber: '123456789012',
      emergencyContact: '+919876543210',
    };

    it('registers a new delivery partner', async () => {
      repo.existsByUserId.mockResolvedValue(false);
      repo.create.mockResolvedValue(makePartner());
      const result = await service.register('user-id', dto);
      expect((result as any).id).toBe('partner-uuid');
    });

    it('throws ConflictException when profile already exists', async () => {
      repo.existsByUserId.mockResolvedValue(true);
      await expect(service.register('user-id', dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('toggleOnline', () => {
    it('sets partner online and emits partner.online event', async () => {
      repo.findByUserId.mockResolvedValue(makePartner({ isApproved: true, isOnline: false }));
      repo.update.mockResolvedValue(makePartner({ isOnline: true }));

      await service.toggleOnline('user-id', { isOnline: true });
      expect(emitter.emit).toHaveBeenCalledWith('partner.online', expect.any(Object));
    });

    it('throws ForbiddenException if partner is not approved', async () => {
      repo.findByUserId.mockResolvedValue(makePartner({ isApproved: false }));
      await expect(service.toggleOnline('user-id', { isOnline: true })).rejects.toThrow(ForbiddenException);
    });

    it('emits partner.offline when going offline', async () => {
      repo.findByUserId.mockResolvedValue(makePartner({ isApproved: true }));
      repo.update.mockResolvedValue(makePartner({ isOnline: false }));

      await service.toggleOnline('user-id', { isOnline: false });
      expect(emitter.emit).toHaveBeenCalledWith('partner.offline', expect.any(Object));
    });
  });

  describe('approve', () => {
    it('approves a delivery partner', async () => {
      repo.findById.mockResolvedValue(makePartner({ isApproved: false }));
      repo.update.mockResolvedValue(makePartner({ isApproved: true }));

      const result = await service.approve('partner-uuid', 'admin-id');
      expect((result as any).isApproved).toBe(true);
    });

    it('throws NotFoundException for non-existent partner', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.approve('bad-id', 'admin-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suspend', () => {
    it('suspends and takes partner offline', async () => {
      repo.findById.mockResolvedValue(makePartner());
      repo.update.mockResolvedValue(makePartner({ isApproved: false, isOnline: false }));

      const result = await service.suspend('partner-uuid', 'admin-id', 'Violation');
      expect((result as any).isApproved).toBe(false);
    });
  });

  describe('findAll (admin)', () => {
    it('filters by approved status', async () => {
      repo.findMany.mockResolvedValue({ items: [makePartner()], total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
      const result = await service.findAll({ approved: true, page: 1, limit: 20 });
      expect(repo.findMany).toHaveBeenCalledWith({ isApproved: true }, expect.any(Object));
      expect((result as any).total).toBe(1);
    });
  });
});
