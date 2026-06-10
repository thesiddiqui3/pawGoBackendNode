import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';

export type VerifyAction = 'approve' | 'reject' | 'request_docs';

interface VerifyDto {
  action: VerifyAction;
  reason?: string;
  note?: string;
  adminNotes?: string;
}

interface PageQuery { page?: number; pageSize?: number }

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Clinic Verification ──────────────────────────────────────────────────

  async listPendingClinics(query: PageQuery) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const where = { isVerified: false, isActive: true, deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.clinic.findMany({
        where, skip, take,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, name: true, slug: true, city: true, state: true,
          phone: true, email: true, logoUrl: true,
          isVerified: true, isActive: true, createdAt: true, createdBy: true,
          verificationNote: true,
        },
      }),
      this.prisma.clinic.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async getClinicVerificationDetail(id: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { id, deletedAt: null },
      include: {
        doctors: { select: { id: true, isVerified: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const owner = clinic.createdBy
      ? await this.prisma.user.findUnique({
          where: { id: clinic.createdBy },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        })
      : null;

    return { ...clinic, owner };
  }

  async verifyClinic(id: string, dto: VerifyDto, adminId: string) {
    const clinic = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null } });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const note = dto.note ?? dto.adminNotes ?? dto.reason ?? null;

    if (dto.action === 'approve') {
      return this.prisma.clinic.update({
        where: { id },
        data: { isVerified: true, isActive: true, verificationNote: null, updatedBy: adminId },
      });
    } else if (dto.action === 'request_docs') {
      // Keep clinic active (owner can still log in) but not verified; store note for owner
      return this.prisma.clinic.update({
        where: { id },
        data: { isVerified: false, isActive: true, verificationNote: note, updatedBy: adminId },
      });
    } else {
      return this.prisma.clinic.update({
        where: { id },
        data: { isVerified: false, isActive: false, verificationNote: note, updatedBy: adminId },
      });
    }
  }

  // ─── Shop Verification ────────────────────────────────────────────────────

  async listPendingShops(query: PageQuery) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const where = { isVerified: false, isActive: true, deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.shop.findMany({
        where, skip, take,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, name: true, slug: true, city: true, state: true,
          phone: true, email: true, logoUrl: true,
          isVerified: true, isActive: true, createdAt: true, createdBy: true,
          verificationNote: true,
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.shop.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async getShopVerificationDetail(id: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        products: { take: 5, select: { id: true, name: true, category: true } },
      },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  async verifyShop(id: string, dto: VerifyDto, adminId: string) {
    const shop = await this.prisma.shop.findFirst({ where: { id, deletedAt: null } });
    if (!shop) throw new NotFoundException('Shop not found');

    const note = dto.note ?? dto.adminNotes ?? dto.reason ?? null;

    if (dto.action === 'approve') {
      return this.prisma.shop.update({
        where: { id },
        data: { isVerified: true, isActive: true, verificationNote: null },
      });
    } else if (dto.action === 'request_docs') {
      return this.prisma.shop.update({
        where: { id },
        data: { isVerified: false, isActive: true, verificationNote: note },
      });
    } else {
      return this.prisma.shop.update({
        where: { id },
        data: { isVerified: false, isActive: false, verificationNote: note },
      });
    }
  }

  // ─── KYC (Delivery Partner) ───────────────────────────────────────────────

  async listPendingKyc(query: PageQuery) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const where = { isApproved: false, suspendedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deliveryPartner.findMany({
        where, skip, take,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, vehicleType: true, vehicleNumber: true, drivingLicense: true,
          aadhaarNumber: true, isApproved: true, isAvailable: true, createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      }),
      this.prisma.deliveryPartner.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async getKycDetail(id: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true } },
        assignments: {
          take: 5, orderBy: { assignedAt: 'desc' },
          select: { id: true, status: true, assignedAt: true, deliveredAt: true },
        },
      },
    });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return partner;
  }

  async verifyKyc(id: string, dto: VerifyDto, adminId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Delivery partner not found');

    if (dto.action === 'approve') {
      return this.prisma.deliveryPartner.update({
        where: { id },
        data: { isApproved: true, approvedAt: new Date(), approvedBy: adminId },
      });
    } else {
      return this.prisma.deliveryPartner.update({
        where: { id },
        data: {
          isApproved: false,
          suspendedAt: new Date(),
          suspendedBy: adminId,
          suspendReason: dto.reason ?? 'KYC rejected',
        },
      });
    }
  }
}
