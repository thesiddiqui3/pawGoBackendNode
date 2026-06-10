import { Injectable } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const INCLUDE_SHOP = {
  shop: { select: { id: true, name: true, slug: true, city: true } },
} satisfies Prisma.ProductInclude;

const ALLOWED_SORT = new Set(['price', 'createdAt', 'stock', 'name']);

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(shopId: string, dto: CreateProductDto, createdBy: string): Promise<Product> {
    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.product.count({ where: { slug } }) > 0) {
      slug = `${baseSlug}-${counter++}`;
    }

    return this.prisma.product.create({
      data: {
        shopId,
        name: dto.name,
        slug,
        description: dto.description,
        category: dto.category,
        brand: dto.brand,
        sku: dto.sku,
        price: dto.price,
        salePrice: dto.salePrice,
        stock: dto.stock,
        unit: dto.unit ?? 'piece',
        tags: dto.tags ?? [],
        weight: dto.weight,
        isFeatured: dto.isFeatured ?? false,
        createdBy,
      },
      include: INCLUDE_SHOP,
    });
  }

  async findById(id: string) {
    return this.prisma.product.findUnique({ where: { id }, include: INCLUDE_SHOP });
  }

  async findMany(query: ProductQueryDto): Promise<PaginatedResponseDto<object>> {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const sortField = query.sortBy && ALLOWED_SORT.has(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(query.shopId && { shopId: query.shopId }),
      ...(query.category && { category: query.category }),
      ...(query.brand && { brand: { contains: query.brand, mode: 'insensitive' } }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { brand: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, skip, take, orderBy: { [sortField]: sortOrder }, include: INCLUDE_SHOP }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResponse(items as object[], total, page, pageSize);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      },
      include: INCLUDE_SHOP,
    });
  }

  async decrementStock(id: string, qty: number): Promise<void> {
    await this.prisma.product.update({
      where: { id },
      data: { stock: { decrement: qty } },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
