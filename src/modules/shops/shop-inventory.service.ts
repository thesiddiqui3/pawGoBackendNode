import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';

const PRODUCT_INCLUDE = {
  shop: { select: { id: true, name: true } },
  images: { select: { url: true, alt: true }, orderBy: { sortOrder: 'asc' as const } },
} as const;

@Injectable()
export class ShopInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveShopId(ownerId: string): Promise<string> {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId }, select: { id: true } });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop.id;
  }

  async listProducts(ownerId: string, query: { page?: number; limit?: number; search?: string; category?: string; status?: string }) {
    const shopId = await this.resolveShopId(ownerId);
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.limit ?? 12);
    const skip = (page - 1) * pageSize;

    const where: any = {
      shopId,
      deletedAt: null,
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
          { brand: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
      ...(query.category ? { category: query.category.toUpperCase() } : {}),
      ...(query.status === 'active'       ? { isActive: true,  stock: { gt: 0 } } : {}),
      ...(query.status === 'inactive'     ? { isActive: false }                   : {}),
      ...(query.status === 'out_of_stock' ? { isActive: true,  stock: 0 }         : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, skip, take: pageSize, include: PRODUCT_INCLUDE, orderBy: { createdAt: 'desc' } }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResponse(items as object[], total, page, pageSize);
  }

  async adjustStock(ownerId: string, productId: string, quantity: number, reason?: string) {
    const shopId = await this.resolveShopId(ownerId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const stockBefore = product.stock;
    const stockAfter = Math.max(0, stockBefore + quantity);
    const type = quantity > 0 ? 'in' : 'out';

    const [updated] = await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: { stock: stockAfter },
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.stockMovement.create({
        data: {
          productId,
          shopId,
          type,
          quantity: Math.abs(quantity),
          stockBefore,
          stockAfter,
          reason: reason ?? 'Manual adjustment',
          createdBy: ownerId,
        },
      }),
    ]);

    return updated;
  }

  async listMovements(ownerId: string, query: { page?: number; limit?: number; productId?: string }) {
    const shopId = await this.resolveShopId(ownerId);
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.limit ?? 50);
    const skip = (page - 1) * pageSize;

    const where: any = {
      shopId,
      ...(query.productId ? { productId: query.productId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true } } },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return buildPaginatedResponse(
      items.map((m: any) => ({
        id: m.id,
        productId: m.productId,
        productName: m.product?.name ?? '',
        type: m.type,
        quantity: m.quantity,
        stockBefore: m.stockBefore,
        stockAfter: m.stockAfter,
        reason: m.reason,
        date: m.createdAt,
      })),
      total,
      page,
      pageSize,
    );
  }
}
