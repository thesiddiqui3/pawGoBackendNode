import { Injectable } from '@nestjs/common';
import { Shop } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class ShopRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateShopDto, createdBy: string): Promise<Shop> {
    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    let counter = 1;
    while (await this.existsBySlug(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    return this.prisma.shop.create({
      data: {
        ownerId,
        name: dto.name,
        slug,
        description: dto.description,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        createdBy,
      },
    });
  }

  async findById(id: string): Promise<Shop | null> {
    return this.prisma.shop.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        _count: { select: { products: true, orders: true } },
      },
    }) as any;
  }

  async findByOwner(ownerId: string): Promise<Shop | null> {
    return this.prisma.shop.findUnique({ where: { ownerId } });
  }

  async findMany(filters: { city?: string; isActive?: boolean; isVerified?: boolean; search?: string; page?: number; limit?: number }) {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 20;
    const skip  = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.isVerified !== undefined && { isVerified: filters.isVerified }),
      ...(filters.city && { city: { contains: filters.city, mode: 'insensitive' as const } }),
      ...(filters.search && { name: { contains: filters.search, mode: 'insensitive' as const } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.shop.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          _count: { select: { products: true, orders: true } },
        },
      }),
      this.prisma.shop.count({ where }),
    ]);
    return { data: items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, dto: UpdateShopDto): Promise<Shop> {
    return this.prisma.shop.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.minOrderAmount !== undefined && { minOrderAmount: dto.minOrderAmount }),
        ...(dto.deliveryCharge !== undefined && { deliveryCharge: dto.deliveryCharge }),
        ...(dto.freeDeliveryAbove !== undefined && { freeDeliveryAbove: dto.freeDeliveryAbove }),
        ...(dto.serviceRadius !== undefined && { serviceRadius: dto.serviceRadius }),
        ...(dto.workingHours !== undefined && { workingHours: dto.workingHours }),
        ...(dto.gstNumber !== undefined && { gstNumber: dto.gstNumber }),
        ...(dto.shopRegNumber !== undefined && { shopRegNumber: dto.shopRegNumber }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.bankAccount !== undefined && { bankAccount: dto.bankAccount }),
        ...(dto.bankIfsc !== undefined && { bankIfsc: dto.bankIfsc }),
      },
    });
  }

  async setActive(id: string, isActive: boolean): Promise<Shop> {
    return this.prisma.shop.update({ where: { id }, data: { isActive } });
  }

  async setVerified(id: string, isVerified: boolean): Promise<Shop> {
    return this.prisma.shop.update({
      where: { id },
      data: { isVerified, ...(isVerified && { isActive: true }) },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.shop.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return (await this.prisma.shop.count({ where: { slug } })) > 0;
  }

  async existsByOwner(ownerId: string): Promise<boolean> {
    return (await this.prisma.shop.count({ where: { ownerId, deletedAt: null } })) > 0;
  }
}
