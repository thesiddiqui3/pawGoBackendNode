import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryStatus } from '@prisma/client';
import { DeliveryPartnerRepository } from '../../delivery-partners/delivery-partner.repository';
import { AssignmentRepository } from '../assignment.repository';
import { AssignmentsService } from '../assignments.service';

const mockAssignmentRepo = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByOrderId: jest.fn(),
  existsByOrderId: jest.fn(),
  findMany: jest.fn(),
  updateStatus: jest.fn(),
});

const mockPartnerRepo = () => ({
  findById: jest.fn(),
  incrementDeliveries: jest.fn(),
});

const mockEmitter = () => ({ emit: jest.fn() });

const makeAssignment = (overrides: Record<string, unknown> = {}) => ({
  id: 'assign-uuid',
  orderId: 'order-uuid',
  deliveryPartnerId: 'partner-uuid',
  assignedBy: 'admin-id',
  assignedAt: new Date(),
  acceptedAt: null,
  pickedUpAt: null,
  outForDeliveryAt: null,
  deliveredAt: null,
  failedAt: null,
  cancelledAt: null,
  status: DeliveryStatus.ASSIGNED,
  notes: null,
  failureReason: null,
  order: { id: 'order-uuid', orderNumber: 'PGO-001', totalAmount: 2400, orderStatus: 'CONFIRMED', address: {}, items: [] },
  deliveryPartner: { id: 'partner-uuid', user: { firstName: 'Rahul', lastName: 'Kumar', phone: '+91' } },
  ...overrides,
});

const makePartner = (overrides: Record<string, unknown> = {}) => ({
  id: 'partner-uuid',
  isApproved: true,
  isOnline: true,
  ...overrides,
});

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  let assignmentRepo: ReturnType<typeof mockAssignmentRepo>;
  let partnerRepo: ReturnType<typeof mockPartnerRepo>;
  let emitter: ReturnType<typeof mockEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: AssignmentRepository, useFactory: mockAssignmentRepo },
        { provide: DeliveryPartnerRepository, useFactory: mockPartnerRepo },
        { provide: EventEmitter2, useFactory: mockEmitter },
      ],
    }).compile();

    service = module.get(AssignmentsService);
    assignmentRepo = module.get(AssignmentRepository) as unknown as ReturnType<typeof mockAssignmentRepo>;
    partnerRepo = module.get(DeliveryPartnerRepository) as unknown as ReturnType<typeof mockPartnerRepo>;
    emitter = module.get(EventEmitter2) as unknown as ReturnType<typeof mockEmitter>;
  });

  describe('create', () => {
    it('creates assignment for an unassigned order', async () => {
      assignmentRepo.existsByOrderId.mockResolvedValue(false);
      partnerRepo.findById.mockResolvedValue(makePartner());
      assignmentRepo.create.mockResolvedValue(makeAssignment());

      const result = await service.create({ orderId: 'order-uuid', deliveryPartnerId: 'partner-uuid' }, 'admin-id');
      expect((result as any).id).toBe('assign-uuid');
      expect(emitter.emit).toHaveBeenCalledWith('delivery.assigned', expect.any(Object));
    });

    it('throws ConflictException when order already assigned', async () => {
      assignmentRepo.existsByOrderId.mockResolvedValue(true);
      await expect(
        service.create({ orderId: 'order-uuid', deliveryPartnerId: 'partner-uuid' }, 'admin-id'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when partner not approved', async () => {
      assignmentRepo.existsByOrderId.mockResolvedValue(false);
      partnerRepo.findById.mockResolvedValue(makePartner({ isApproved: false }));
      await expect(
        service.create({ orderId: 'order-uuid', deliveryPartnerId: 'partner-uuid' }, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('accept', () => {
    it('accepts assignment when partner is online', async () => {
      assignmentRepo.findById.mockResolvedValue(makeAssignment());
      partnerRepo.findById.mockResolvedValue(makePartner({ isOnline: true }));
      assignmentRepo.updateStatus.mockResolvedValue(makeAssignment({ status: DeliveryStatus.ACCEPTED, acceptedAt: new Date() }));

      const result = await service.accept('assign-uuid', 'partner-uuid');
      expect((result as any).status).toBe(DeliveryStatus.ACCEPTED);
      expect(emitter.emit).toHaveBeenCalledWith('delivery.accepted', expect.any(Object));
    });

    it('throws BadRequestException when partner is offline', async () => {
      assignmentRepo.findById.mockResolvedValue(makeAssignment());
      partnerRepo.findById.mockResolvedValue(makePartner({ isOnline: false }));
      await expect(service.accept('assign-uuid', 'partner-uuid')).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when wrong partner tries to accept', async () => {
      assignmentRepo.findById.mockResolvedValue(makeAssignment({ deliveryPartnerId: 'other-partner' }));
      await expect(service.accept('assign-uuid', 'partner-uuid')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('status transitions', () => {
    it('ACCEPTED → PICKED_UP emits delivery.picked_up', async () => {
      assignmentRepo.findById.mockResolvedValue(makeAssignment({ status: DeliveryStatus.ACCEPTED }));
      assignmentRepo.updateStatus.mockResolvedValue(makeAssignment({ status: DeliveryStatus.PICKED_UP }));

      await service.pickup('assign-uuid', 'partner-uuid');
      expect(emitter.emit).toHaveBeenCalledWith('delivery.picked_up', expect.any(Object));
    });

    it('PICKED_UP → OUT_FOR_DELIVERY emits delivery.started', async () => {
      assignmentRepo.findById.mockResolvedValue(makeAssignment({ status: DeliveryStatus.PICKED_UP }));
      assignmentRepo.updateStatus.mockResolvedValue(makeAssignment({ status: DeliveryStatus.OUT_FOR_DELIVERY }));

      await service.startDelivery('assign-uuid', 'partner-uuid');
      expect(emitter.emit).toHaveBeenCalledWith('delivery.started', expect.any(Object));
    });

    it('OUT_FOR_DELIVERY → DELIVERED emits delivery.completed', async () => {
      assignmentRepo.findById.mockResolvedValue(makeAssignment({ status: DeliveryStatus.OUT_FOR_DELIVERY }));
      assignmentRepo.updateStatus.mockResolvedValue(makeAssignment({ status: DeliveryStatus.DELIVERED }));
      partnerRepo.incrementDeliveries.mockResolvedValue({});

      await service.markDelivered('assign-uuid', 'partner-uuid');
      expect(emitter.emit).toHaveBeenCalledWith('delivery.completed', expect.any(Object));
    });

    it('throws BadRequestException for invalid transition', async () => {
      assignmentRepo.findById.mockResolvedValue(makeAssignment({ status: DeliveryStatus.DELIVERED }));
      await expect(service.pickup('assign-uuid', 'partner-uuid')).rejects.toThrow(BadRequestException);
    });

    it('FAILED transition sets failureReason', async () => {
      assignmentRepo.findById.mockResolvedValue(makeAssignment({ status: DeliveryStatus.OUT_FOR_DELIVERY }));
      assignmentRepo.updateStatus.mockResolvedValue(makeAssignment({ status: DeliveryStatus.FAILED }));

      await service.markFailed('assign-uuid', 'partner-uuid', { reason: 'Customer unreachable' });
      expect(assignmentRepo.updateStatus).toHaveBeenCalledWith(
        'assign-uuid',
        DeliveryStatus.FAILED,
        expect.objectContaining({ failureReason: 'Customer unreachable' }),
      );
      expect(emitter.emit).toHaveBeenCalledWith('delivery.failed', expect.any(Object));
    });
  });
});
