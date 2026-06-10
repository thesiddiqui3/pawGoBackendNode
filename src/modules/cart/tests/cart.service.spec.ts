import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CartRepository } from '../cart.repository';
import { CartService } from '../cart.service';
import { ProductRepository } from '../../products/product.repository';

const mockCartRepo = () => ({
  findOrCreateByUser: jest.fn(),
  findByUser: jest.fn(),
  upsertItem: jest.fn(),
  updateItemQuantity: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
  getItem: jest.fn(),
});

const mockProductRepo = () => ({
  findById: jest.fn(),
});

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'prod-uuid',
  name: 'Dog Food 3kg',
  slug: 'dog-food-3kg',
  price: 1200,
  salePrice: null,
  stock: 50,
  imageUrl: null,
  isActive: true,
  deletedAt: null,
  shopId: 'shop-uuid',
  shop: { id: 'shop-uuid', name: 'Pawsome Store' },
  ...overrides,
});

const makeCart = (items: object[] = []) => ({
  id: 'cart-uuid',
  userId: 'user-id',
  items,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('CartService', () => {
  let service: CartService;
  let cartRepo: ReturnType<typeof mockCartRepo>;
  let productRepo: ReturnType<typeof mockProductRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: CartRepository, useFactory: mockCartRepo },
        { provide: ProductRepository, useFactory: mockProductRepo },
      ],
    }).compile();

    service = module.get(CartService);
    cartRepo = module.get(CartRepository) as unknown as ReturnType<typeof mockCartRepo>;
    productRepo = module.get(ProductRepository) as unknown as ReturnType<typeof mockProductRepo>;
  });

  describe('addItem', () => {
    it('adds a product to the cart', async () => {
      productRepo.findById.mockResolvedValue(makeProduct());
      cartRepo.findOrCreateByUser.mockResolvedValue(makeCart());
      cartRepo.getItem.mockResolvedValue(null);
      cartRepo.upsertItem.mockResolvedValue({ quantity: 2 });
      cartRepo.findByUser.mockResolvedValue(makeCart([
        { product: makeProduct(), quantity: 2 },
      ]));

      const result = await service.addItem('user-id', { productId: 'prod-uuid', quantity: 2 });
      expect(result.totalItems).toBe(2);
      expect(result.subtotal).toBe(2400);
    });

    it('throws BadRequestException when stock is insufficient', async () => {
      productRepo.findById.mockResolvedValue(makeProduct({ stock: 1 }));
      cartRepo.findOrCreateByUser.mockResolvedValue(makeCart());
      cartRepo.getItem.mockResolvedValue(null);

      await expect(
        service.addItem('user-id', { productId: 'prod-uuid', quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when adding would exceed stock', async () => {
      productRepo.findById.mockResolvedValue(makeProduct({ stock: 3 }));
      cartRepo.findOrCreateByUser.mockResolvedValue(makeCart());
      cartRepo.getItem.mockResolvedValue({ quantity: 2 }); // already 2 in cart

      await expect(
        service.addItem('user-id', { productId: 'prod-uuid', quantity: 2 }), // 2+2=4 > 3
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for inactive product', async () => {
      productRepo.findById.mockResolvedValue(makeProduct({ isActive: false }));
      await expect(
        service.addItem('user-id', { productId: 'prod-uuid', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateItem', () => {
    it('updates quantity for existing cart item', async () => {
      cartRepo.findOrCreateByUser.mockResolvedValue(makeCart());
      cartRepo.getItem.mockResolvedValue({ quantity: 1 });
      productRepo.findById.mockResolvedValue(makeProduct());
      cartRepo.updateItemQuantity.mockResolvedValue({ quantity: 3 });
      cartRepo.findByUser.mockResolvedValue(makeCart([
        { product: makeProduct(), quantity: 3 },
      ]));

      const result = await service.updateItem('user-id', 'prod-uuid', { quantity: 3 });
      expect(result.totalItems).toBe(3);
    });

    it('throws NotFoundException when item not in cart', async () => {
      cartRepo.findOrCreateByUser.mockResolvedValue(makeCart());
      cartRepo.getItem.mockResolvedValue(null);

      await expect(
        service.updateItem('user-id', 'prod-uuid', { quantity: 2 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    it('removes item from cart', async () => {
      cartRepo.findOrCreateByUser.mockResolvedValue(makeCart());
      cartRepo.removeItem.mockResolvedValue(undefined);
      cartRepo.findByUser.mockResolvedValue(makeCart([]));

      const result = await service.removeItem('user-id', 'prod-uuid');
      expect(result.items).toHaveLength(0);
    });
  });

  describe('clearCart', () => {
    it('clears all items from the cart', async () => {
      cartRepo.findOrCreateByUser.mockResolvedValue(makeCart());
      cartRepo.clearCart.mockResolvedValue(undefined);
      cartRepo.findByUser.mockResolvedValue(makeCart([]));

      const result = await service.clearCart('user-id');
      expect(result.totalItems).toBe(0);
      expect(result.subtotal).toBe(0);
    });
  });

  describe('getCart', () => {
    it('returns cart summary with computed totals using salePrice', async () => {
      const product = makeProduct({ price: 1200, salePrice: 999 });
      cartRepo.findOrCreateByUser.mockResolvedValue(makeCart([
        { product, quantity: 2 },
      ]));

      const result = await service.getCart('user-id');
      expect(result.items[0].unitPrice).toBe(999);
      expect(result.subtotal).toBe(1998);
    });
  });
});
