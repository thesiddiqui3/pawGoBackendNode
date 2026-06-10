import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CartRepository, CartWithItems } from './cart.repository';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ProductRepository } from '../products/product.repository';

export interface CartSummary {
  id: string;
  userId: string;
  items: CartItemSummary[];
  totalItems: number;
  subtotal: number;
  updatedAt: Date;
}

export interface CartItemSummary {
  productId: string;
  productName: string;
  shopId: string;
  shopName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  stock: number;
  imageUrl: string | null;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async getCart(userId: string): Promise<CartSummary> {
    const cart = await this.cartRepository.findOrCreateByUser(userId);
    return this.buildSummary(cart);
  }

  async addItem(userId: string, dto: AddToCartDto): Promise<CartSummary> {
    const product = await this.productRepository.findById(dto.productId);
    if (!product || product.deletedAt || !product.isActive) {
      throw new NotFoundException('Product not found or inactive');
    }
    if (product.stock < dto.quantity) {
      throw new BadRequestException(
        `Only ${product.stock} unit(s) available in stock`,
      );
    }

    const cart = await this.cartRepository.findOrCreateByUser(userId);

    // Check existing quantity
    const existing = await this.cartRepository.getItem(cart.id, dto.productId);
    const newQty = (existing?.quantity ?? 0) + dto.quantity;

    if (newQty > product.stock) {
      throw new BadRequestException(
        `Cannot add ${dto.quantity} more — only ${product.stock - (existing?.quantity ?? 0)} unit(s) available`,
      );
    }

    await this.cartRepository.upsertItem(cart.id, dto.productId, newQty);

    const updated = await this.cartRepository.findByUser(userId);
    return this.buildSummary(updated!);
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto): Promise<CartSummary> {
    const cart = await this.cartRepository.findOrCreateByUser(userId);
    const existing = await this.cartRepository.getItem(cart.id, productId);
    if (!existing) throw new NotFoundException('Item not in cart');

    const product = await this.productRepository.findById(productId);
    if (!product || product.deletedAt || !product.isActive) {
      throw new NotFoundException('Product not found or inactive');
    }
    if (dto.quantity > product.stock) {
      throw new BadRequestException(`Only ${product.stock} unit(s) in stock`);
    }

    await this.cartRepository.updateItemQuantity(cart.id, productId, dto.quantity);
    const updated = await this.cartRepository.findByUser(userId);
    return this.buildSummary(updated!);
  }

  async removeItem(userId: string, productId: string): Promise<CartSummary> {
    const cart = await this.cartRepository.findOrCreateByUser(userId);
    await this.cartRepository.removeItem(cart.id, productId);
    const updated = await this.cartRepository.findByUser(userId);
    return this.buildSummary(updated!);
  }

  async clearCart(userId: string): Promise<CartSummary> {
    const cart = await this.cartRepository.findOrCreateByUser(userId);
    await this.cartRepository.clearCart(cart.id);
    const updated = await this.cartRepository.findByUser(userId);
    return this.buildSummary(updated!);
  }

  private buildSummary(cart: CartWithItems): CartSummary {
    const items: CartItemSummary[] = cart.items.map((item) => {
      const unitPrice = item.product.salePrice ?? item.product.price;
      return {
        productId: item.product.id,
        productName: item.product.name,
        shopId: item.product.shopId,
        shopName: item.product.shop.name,
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity,
        stock: item.product.stock,
        imageUrl: item.product.imageUrl,
      };
    });

    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      totalItems,
      subtotal,
      updatedAt: cart.updatedAt,
    };
  }
}
