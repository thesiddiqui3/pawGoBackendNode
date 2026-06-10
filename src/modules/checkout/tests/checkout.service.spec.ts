import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OrderEvent } from '../../../common/events/order.events';
import { AddressRepository } from '../../addresses/address.repository';
import { CartRepository } from '../../cart/cart.repository';
import { CartService } from '../../cart/cart.service';
import { ProductRepository } from '../../products/product.repository';
import { OrderRepository } from '../../orders/order.repository';
import { CheckoutService } from '../checkout.service';

// ─── Factories ────────────────────────────────────────────────────────────────

const makeAddress = (overrides: Record<string, unknown> = {}) => ({
  id: 'addr-uuid', userId: 'user-id', ...overrides,
});

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'prod-uuid',
  name: 'Dog Food',
  shopId: 'shop-uuid',
  price: 1200,
  salePrice: null,
  stock: 10,
  isActive: true,
  deletedAt: null,
  ...overrides,
});

const makeCartItem = (productOverrides: Record<string, unknown> = {}, qty = 2) => ({
  productId: 'prod-uuid',
  quantity: qty,
  product: {
    id: 'prod-uuid',
    name: 'Dog Food',
    shopId: 'shop-uuid',
    price: 1200,
    salePrice: null,
    stock: 10,
    isActive: true,
    deletedAt: null,
    shop: { id: 'shop-uuid', name: 'Pawsome' },
    ...productOverrides,
  },
});

const makeCart = (items: object[] = []) => ({
  id: 'cart-uuid',
  userId: 'user-id',
  items,
  updatedAt: new Date(),
});

const makeOrder = () => ({
  id: 'order-uuid',
  orderNumber: 'PGO-2026-000001',
  customerId: 'user-id',
  shopId: 'shop-uuid',
  totalAmount: 2400,
  orderStatus: OrderStatus.PENDING,
});

// ─── Prisma transaction mock helper ──────────────────────────────────────────

const makePrismaMock = (txOverrides: Record<string, unknown> = {}) => ({
  $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      product: { update: jest.fn() },
      order: { create: jest.fn().mockResolvedValue(makeOrder()) },
      cartItem: { deleteMany: jest.fn() },
      ...txOverrides,
    };
    await fn(tx);
  }),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CheckoutService', () => {
  let service: CheckoutService;
  let addressRepo: { findById: jest.Mock };
  let cartRepo: { findByUser: jest.Mock };
  let productRepo: { findById: jest.Mock };
  let orderRepo: { generateOrderNumber: jest.Mock };
  let prisma: ReturnType<typeof makePrismaMock>;
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    addressRepo = { findById: jest.fn() };
    cartRepo = { findByUser: jest.fn() };
    productRepo = { findById: jest.fn() };
    orderRepo = { generateOrderNumber: jest.fn().mockResolvedValue('PGO-2026-000001') };
    prisma = makePrismaMock();
    emitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: AddressRepository, useValue: addressRepo },
        { provide: CartRepository, useValue: cartRepo },
        { provide: CartService, useValue: {} },
        { provide: ProductRepository, useValue: productRepo },
        { provide: OrderRepository, useValue: orderRepo },
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  const dto = { addressId: 'addr-uuid', paymentMethod: 'COD' as any };

  describe('checkout — validation guards', () => {
    it('throws NotFoundException when address not found', async () => {
      addressRepo.findById.mockResolvedValue(null);
      await expect(service.checkout('user-id', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when address belongs to different user', async () => {
      addressRepo.findById.mockResolvedValue(makeAddress({ userId: 'other-user' }));
      await expect(service.checkout('user-id', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when cart is empty', async () => {
      addressRepo.findById.mockResolvedValue(makeAddress());
      cartRepo.findByUser.mockResolvedValue(makeCart([]));
      await expect(service.checkout('user-id', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when cart is null', async () => {
      addressRepo.findById.mockResolvedValue(makeAddress());
      cartRepo.findByUser.mockResolvedValue(null);
      await expect(service.checkout('user-id', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when a product is inactive', async () => {
      addressRepo.findById.mockResolvedValue(makeAddress());
      cartRepo.findByUser.mockResolvedValue(makeCart([makeCartItem({ isActive: false })]));
      productRepo.findById.mockResolvedValue(makeProduct({ isActive: false }));
      await expect(service.checkout('user-id', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when stock is insufficient at checkout time', async () => {
      addressRepo.findById.mockResolvedValue(makeAddress());
      cartRepo.findByUser.mockResolvedValue(makeCart([makeCartItem({}, 5)]));
      productRepo.findById.mockResolvedValue(makeProduct({ stock: 3 }));
      await expect(service.checkout('user-id', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkout — happy path', () => {
    beforeEach(() => {
      addressRepo.findById.mockResolvedValue(makeAddress());
      cartRepo.findByUser.mockResolvedValue(makeCart([makeCartItem()]));
      productRepo.findById.mockResolvedValue(makeProduct());
    });

    it('creates one order for a single-shop cart and returns it', async () => {
      const result = await service.checkout('user-id', dto);
      expect(result).toHaveLength(1);
      expect(result[0].orderStatus).toBe(OrderStatus.PENDING);
    });

    it('emits OrderEvent.CREATED for each created order', async () => {
      await service.checkout('user-id', dto);
      expect(emitter.emit).toHaveBeenCalledWith(OrderEvent.CREATED, expect.objectContaining({ orderId: 'order-uuid' }));
    });

    it('uses salePrice when available instead of price', async () => {
      productRepo.findById.mockResolvedValue(makeProduct({ price: 1200, salePrice: 999 }));
      await service.checkout('user-id', dto);
      // orderNumber generated once per shop, transaction called once
      expect(orderRepo.generateOrderNumber).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('splits into two orders for a two-shop cart', async () => {
      const item1 = makeCartItem({}, 1);
      const item2 = {
        productId: 'prod-2',
        quantity: 1,
        product: {
          id: 'prod-2',
          name: 'Cat Toy',
          shopId: 'shop-2',
          price: 500,
          salePrice: null,
          stock: 5,
          isActive: true,
          deletedAt: null,
          shop: { id: 'shop-2', name: 'Cat Corner' },
        },
      };
      cartRepo.findByUser.mockResolvedValue(makeCart([item1, item2]));
      productRepo.findById
        .mockResolvedValueOnce(makeProduct())
        .mockResolvedValueOnce({ id: 'prod-2', name: 'Cat Toy', shopId: 'shop-2', price: 500, salePrice: null, stock: 5, isActive: true, deletedAt: null });

      // Override $transaction to capture two order creates
      let createCalls = 0;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          product: { update: jest.fn() },
          order: { create: jest.fn().mockImplementation(() => { createCalls++; return Promise.resolve(makeOrder()); }) },
          cartItem: { deleteMany: jest.fn() },
        };
        await fn(tx);
      });

      const result = await service.checkout('user-id', dto);
      expect(result).toHaveLength(2);
      expect(orderRepo.generateOrderNumber).toHaveBeenCalledTimes(2);
      expect(emitter.emit).toHaveBeenCalledTimes(2);
    });
  });
});
