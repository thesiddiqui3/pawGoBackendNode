import { Injectable } from '@nestjs/common';
import { VerificationDocStatus, VerificationDocType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VerificationDocsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    clinicId?: string;
    shopId?: string;
    doctorId?: string;
    deliveryPartnerId?: string;
    docType: VerificationDocType;
    fileUrl: string;
    filePublicId: string;
    uploadedBy: string;
  }) {
    return this.prisma.verificationDocument.create({ data });
  }

  async findAllForDoctor(doctorId: string) {
    return this.prisma.verificationDocument.findMany({ where: { doctorId }, orderBy: { createdAt: 'desc' } });
  }

  async findAllForDeliveryPartner(deliveryPartnerId: string) {
    return this.prisma.verificationDocument.findMany({ where: { deliveryPartnerId }, orderBy: { createdAt: 'desc' } });
  }

  async findAllForClinic(clinicId: string) {
    return this.prisma.verificationDocument.findMany({ where: { clinicId }, orderBy: { createdAt: 'desc' } });
  }

  async findAllForShop(shopId: string) {
    return this.prisma.verificationDocument.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string) {
    return this.prisma.verificationDocument.findUnique({ where: { id } });
  }

  async reviewDoc(id: string, action: 'approve' | 'reject', reviewedBy: string, rejectedReason?: string) {
    return this.prisma.verificationDocument.update({
      where: { id },
      data: {
        status: action === 'approve' ? VerificationDocStatus.APPROVED : VerificationDocStatus.REJECTED,
        reviewedBy,
        reviewedAt: new Date(),
        ...(rejectedReason ? { rejectedReason } : {}),
      },
    });
  }

  async deleteDoc(id: string) {
    return this.prisma.verificationDocument.delete({ where: { id } });
  }

  async allApprovedForClinic(clinicId: string): Promise<boolean> {
    const pending = await this.prisma.verificationDocument.count({
      where: { clinicId, status: { not: VerificationDocStatus.APPROVED } },
    });
    const total = await this.prisma.verificationDocument.count({ where: { clinicId } });
    return total > 0 && pending === 0;
  }

  async allApprovedForShop(shopId: string): Promise<boolean> {
    const pending = await this.prisma.verificationDocument.count({
      where: { shopId, status: { not: VerificationDocStatus.APPROVED } },
    });
    const total = await this.prisma.verificationDocument.count({ where: { shopId } });
    return total > 0 && pending === 0;
  }
}
