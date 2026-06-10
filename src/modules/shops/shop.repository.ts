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
    return this.prisma.shop.findUnique({ where: { id } });
  }

  async findByOwner(ownerId: string): Promise<Shop | null> {
    return this.prisma.shop.findUnique({ where: { ownerId } });
  }

  async findMany(filters: { city?: string; isActive?: boolean; isVerified?: boolean; search?: string }) {
    return this.prisma.shop.findMany({
      where: {
        deletedAt: null,
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters.isVerified !== undefined && { isVerified: filters.isVerified }),
        ...(filters.city && { city: { contains: filters.city, mode: 'insensitive' } }),
        ...(filters.search && { name: { contains: filters.search, mode: 'insensitive' } }),
      },
      orderBy: { rating: 'desc' },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
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
      },
    });
  }

  async setActive(id: string, isActive: boolean): Promise<Shop> {
    return this.prisma.shop.update({ where: { id }, data: { isActive } });
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
