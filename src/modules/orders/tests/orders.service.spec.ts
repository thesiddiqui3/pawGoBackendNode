import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '@prisma/client';
import { OrderEvent } from '../../../common/events/order.events';
import { UserRole } from '../../../common/enums';
import { OrderRepository } from '../order.repository';
import { OrdersService } from '../orders.service';

const mockOrderRepo = () => ({
  findById: jest.fn(),
  findMany: jest.fn(),
  updateStatus: jest.fn(),
  addTimeline: jest.fn(),
  getTimeline: jest.fn(),
  getStats: jest.fn(),
  generateOrderNumber: jest.fn(),
  create: jest.fn(),
});

const mockEventEmitter = () => ({ emit: jest.fn() });

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-uuid',
  orderNumber: 'PGO-2026-000001',
  customerId: 'customer-id',
  shopId: 'shop-uuid',
  addressId: 'addr-uuid',
  orderStatus: OrderStatus.PENDING,
  totalAmount: 2400,
  ...overrides,
});

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof mockOrderRepo>;
  let emitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrderRepository, useFactory: mockOrderRepo },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get(OrdersService);
    orderRepo = module.get(OrderRepository) as unknown as ReturnType<typeof mockOrderRepo>;
    emitter = module.get(EventEmitter2) as unknown as ReturnType<typeof mockEventEmitter>;
  });

  describe('findOne', () => {
    it('returns order for the customer who owns it', async () => {
      orderRepo.findById.mockResolvedValue(makeOrder());
      const result = await service.findOne('order-uuid', 'customer-id', UserRole.PET_OWNER);
      expect((result as any).id).toBe('order-uuid');
    });

    it('throws NotFoundException when order not found', async () => {
      orderRepo.findById.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'customer-id', UserRole.PET_OWNER)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for unrelated customer', async () => {
      orderRepo.findById.mockResolvedValue(makeOrder({ customerId: 'other-customer' }));
      await expect(service.findOne('order-uuid', 'intruder', UserRole.PET_OWNER)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('allows customer to cancel a PENDING order', async () => {
      const pending = makeOrder({ orderStatus: OrderStatus.PENDING });
      const cancelled = makeOrder({ orderStatus: OrderStatus.CANCELLED });
      orderRepo.findById.mockResolvedValue(pending);
      orderRepo.updateStatus.mockResolvedValue(cancelled);
      orderRepo.addTimeline.mockResolvedValue({});

      const result = await service.cancel('order-uuid', { reason: 'Changed mind' }, 'customer-id', UserRole.PET_OWNER);
      expect((result as any).orderStatus).toBe(OrderStatus.CANCELLED);
      expect(emitter.emit).toHaveBeenCalledWith(OrderEvent.CANCELLED, expect.objectContaining({ orderId: 'order-uuid' }));
    });

    it('throws BadRequestException when trying to cancel a DELIVERED order', async () => {
      orderRepo.findById.mockResolvedValue(makeOrder({ orderStatus: OrderStatus.DELIVERED }));
      await expect(
        service.cancel('order-uuid', {}, 'customer-id', UserRole.PET_OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when non-owner tries to cancel', async () => {
      orderRepo.findById.mockResolvedValue(makeOrder({ customerId: 'real-owner' }));
      await expect(
        service.cancel('order-uuid', {}, 'intruder', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    it('transitions PENDING → CONFIRMED and emits event', async () => {
      const pending = makeOrder({ orderStatus: OrderStatus.PENDING });
      const confirmed = makeOrder({ orderStatus: OrderStatus.CONFIRMED });
      orderRepo.findById.mockResolvedValue(pending);
      orderRepo.updateStatus.mockResolvedValue(confirmed);
      orderRepo.addTimeline.mockResolvedValue({});

      await service.updateStatus('order-uuid', OrderStatus.CONFIRMED, 'shop-owner', UserRole.SHOP_OWNER);
      expect(emitter.emit).toHaveBeenCalledWith(OrderEvent.CONFIRMED, expect.any(Object));
    });

    it('throws BadRequestException for invalid transition', async () => {
      orderRepo.findById.mockResolvedValue(makeOrder({ orderStatus: OrderStatus.DELIVERED }));
      await expect(
        service.updateStatus('order-uuid', OrderStatus.PACKED, 'admin', UserRole.SUPER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('transitions OUT_FOR_DELIVERY → DELIVERED and sets deliveredAt', async () => {
      const outForDelivery = makeOrder({ orderStatus: OrderStatus.OUT_FOR_DELIVERY });
      const delivered = makeOrder({ orderStatus: OrderStatus.DELIVERED });
      orderRepo.findById.mockResolvedValue(outForDelivery);
      orderRepo.updateStatus.mockResolvedValue(delivered);
      orderRepo.addTimeline.mockResolvedValue({});

      await service.updateStatus('order-uuid', OrderStatus.DELIVERED, 'shop-owner', UserRole.SHOP_OWNER);
      expect(orderRepo.updateStatus).toHaveBeenCalledWith(
        'order-uuid',
        OrderStatus.DELIVERED,
        expect.objectContaining({ deliveredAt: expect.any(Date) }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(OrderEvent.DELIVERED, expect.any(Object));
    });
  });

  describe('getCustomerStats', () => {
    it('returns stats for the customer', async () => {
      const stats = { totalOrders: 10, pendingOrders: 2, deliveredOrders: 7, cancelledOrders: 1 };
      orderRepo.getStats.mockResolvedValue(stats);

      const result = await service.getCustomerStats('customer-id');
      expect(result).toEqual(stats);
      expect(orderRepo.getStats).toHaveBeenCalledWith({ customerId: 'customer-id' });
    });
  });
});
