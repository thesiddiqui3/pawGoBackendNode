import { Injectable } from '@nestjs/common';
import { Cart, CartItem, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type CartWithItems = Cart & {
  items: (CartItem & {
    product: {
      id: string;
      name: string;
      slug: string;
      price: number;
      salePrice: number | null;
      stock: number;
      imageUrl: string | null;
      isActive: boolean;
      deletedAt: Date | null;
      shopId: string;
      shop: { id: string; name: string };
    };
  })[];
};

const CART_INCLUDE: Prisma.CartInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          salePrice: true,
          stock: true,
          imageUrl: true,
          isActive: true,
          deletedAt: true,
          shopId: true,
          shop: { select: { id: true, name: true } },
        },
      },
    },
  },
};

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByUser(userId: string): Promise<CartWithItems> {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: CART_INCLUDE,
    }) as unknown as CartWithItems;
  }

  async findByUser(userId: string): Promise<CartWithItems | null> {
    return this.prisma.cart.findUnique({
      where: { userId },
      include: CART_INCLUDE,
    }) as unknown as CartWithItems | null;
  }

  async upsertItem(cartId: string, productId: string, quantity: number): Promise<CartItem> {
    return this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: { cartId, productId, quantity },
      update: { quantity },
    });
  }

  async updateItemQuantity(cartId: string, productId: string, quantity: number): Promise<CartItem> {
    return this.prisma.cartItem.update({
      where: { cartId_productId: { cartId, productId } },
      data: { quantity },
    });
  }

  async removeItem(cartId: string, productId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cartId, productId } });
  }

  async clearCart(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
  }

  async getItem(cartId: string, productId: string): Promise<CartItem | null> {
    return this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });
  }
}
