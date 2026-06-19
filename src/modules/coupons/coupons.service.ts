import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getShopForOwner(ownerId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId }, select: { id: true } });
    if (!shop) throw new NotFoundException('Shop not found for this owner');
    return shop;
  }

  async getAll(ownerId: string) {
    const shop = await this.getShopForOwner(ownerId);
    const now = new Date();

    // Auto-expire past-expiry coupons
    await this.prisma.coupon.updateMany({
      where: { shopId: shop.id, status: CouponStatus.ACTIVE, expiryDate: { lt: now } },
      data: { status: CouponStatus.EXPIRED },
    });

    return this.prisma.coupon.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(ownerId: string, dto: CreateCouponDto) {
    const shop = await this.getShopForOwner(ownerId);

    const existing = await this.prisma.coupon.findUnique({
      where: { shopId_code: { shopId: shop.id, code: dto.code.toUpperCase() } },
    });
    if (existing) throw new BadRequestException(`Coupon code "${dto.code}" already exists`);

    return this.prisma.coupon.create({
      data: {
        shopId:        shop.id,
        code:          dto.code.toUpperCase(),
        type:          dto.type,
        value:         dto.value,
        description:   dto.description ?? '',
        minOrderAmount: dto.minOrderAmount,
        usageLimit:    dto.usageLimit,
        startDate:     new Date(dto.startDate),
        expiryDate:    new Date(dto.expiryDate),
        createdBy:     ownerId,
      },
    });
  }

  async update(ownerId: string, couponId: string, dto: UpdateCouponDto) {
    const shop = await this.getShopForOwner(ownerId);
    const coupon = await this.prisma.coupon.findFirst({ where: { id: couponId, shopId: shop.id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (dto.code && dto.code.toUpperCase() !== coupon.code) {
      const conflict = await this.prisma.coupon.findUnique({
        where: { shopId_code: { shopId: shop.id, code: dto.code.toUpperCase() } },
      });
      if (conflict) throw new BadRequestException(`Coupon code "${dto.code}" already exists`);
    }

    return this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.minOrderAmount !== undefined && { minOrderAmount: dto.minOrderAmount }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.expiryDate !== undefined && { expiryDate: new Date(dto.expiryDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(ownerId: string, couponId: string) {
    const shop = await this.getShopForOwner(ownerId);
    const coupon = await this.prisma.coupon.findFirst({ where: { id: couponId, shopId: shop.id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.prisma.coupon.delete({ where: { id: couponId } });
  }
}
