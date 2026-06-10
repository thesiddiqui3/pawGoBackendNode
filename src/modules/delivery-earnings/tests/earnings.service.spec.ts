import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryPartnerRepository } from '../../delivery-partners/delivery-partner.repository';
import { AssignmentRepository } from '../../delivery-assignments/assignment.repository';
import { EarningRepository } from '../earning.repository';
import { EarningsService } from '../earnings.service';

const mockEarningRepo = () => ({
  create: jest.fn(),
  findMany: jest.fn(),
  sumByPeriod: jest.fn(),
  sumAll: jest.fn(),
});

const mockPartnerRepo = () => ({
  findById: jest.fn(),
  incrementDeliveries: jest.fn(),
  updateRating: jest.fn(),
});

const mockAssignmentRepo = () => ({
  findById: jest.fn(),
});

const makePartner = (overrides: Record<string, unknown> = {}) => ({
  id: 'partner-uuid',
  userId: 'user-id',
  totalEarnings: 1000,
  totalDeliveries: 20,
  averageRating: 4.5,
  ...overrides,
});

describe('EarningsService', () => {
  let service: EarningsService;
  let earningRepo: ReturnType<typeof mockEarningRepo>;
  let partnerRepo: ReturnType<typeof mockPartnerRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EarningsService,
        { provide: EarningRepository, useFactory: mockEarningRepo },
        { provide: DeliveryPartnerRepository, useFactory: mockPartnerRepo },
        { provide: AssignmentRepository, useFactory: mockAssignmentRepo },
      ],
    }).compile();

    service = module.get(EarningsService);
    earningRepo = module.get(EarningRepository) as unknown as ReturnType<typeof mockEarningRepo>;
    partnerRepo = module.get(DeliveryPartnerRepository) as unknown as ReturnType<typeof mockPartnerRepo>;
  });

  describe('getSummary', () => {
    it('returns earnings summary for a partner', async () => {
      partnerRepo.findById.mockResolvedValue(makePartner());
      earningRepo.sumByPeriod.mockResolvedValue(500);
      earningRepo.sumAll.mockResolvedValue(12500);

      const result = await service.getSummary('partner-uuid');
      expect((result as any).total).toBe(12500);
      expect((result as any).today).toBe(500);
      expect((result as any).week).toBe(500);
      expect((result as any).month).toBe(500);
    });

    it('throws NotFoundException when partner not found', async () => {
      partnerRepo.findById.mockResolvedValue(null);
      await expect(service.getSummary('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleDeliveryCompleted (event listener)', () => {
    it('records an earning when delivery completes', async () => {
      const mockAssignRepo = { findById: jest.fn().mockResolvedValue({ id: 'assign-uuid' }) };
      (service as any).assignmentRepository = mockAssignRepo;
      earningRepo.create.mockResolvedValue({ id: 'earning-uuid', amount: 50 });
      partnerRepo.incrementDeliveries.mockResolvedValue({});

      await service.handleDeliveryCompleted({
        assignmentId: 'assign-uuid',
        orderId: 'order-uuid',
        deliveryPartnerId: 'partner-uuid',
        status: 'DELIVERED',
      });

      expect(earningRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50, type: 'DELIVERY_FEE' }),
      );
      expect(partnerRepo.incrementDeliveries).toHaveBeenCalledWith('partner-uuid', 50);
    });
  });
});
