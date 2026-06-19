import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { VerificationDocType } from '@prisma/client';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { PrismaService } from '../../database/prisma.service';
import { ReviewDocDto, UploadDocDto } from './dto/upload-doc.dto';
import { VerificationDocsRepository } from './verification-docs.repository';

@Injectable()
export class VerificationDocsService {
  constructor(
    private readonly repo: VerificationDocsRepository,
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ─── Resolve clinic for owner or staff ───────────────────────────────────

  private async resolveClinicForUser(userId: string): Promise<{ id: string; isVerified: boolean } | null> {
    const owned = await this.prisma.clinic.findFirst({
      where: { createdBy: userId, deletedAt: null },
      select: { id: true, isVerified: true },
    });
    if (owned) return owned;
    const staff = await this.prisma.clinicStaff.findUnique({
      where: { userId },
      select: { clinicId: true },
    });
    if (!staff) return null;
    return this.prisma.clinic.findFirst({
      where: { id: staff.clinicId, deletedAt: null },
      select: { id: true, isVerified: true },
    });
  }

  // ─── CLINIC_OWNER / CLINIC_MANAGER submits a doc ─────────────────────────

  async uploadClinicDoc(ownerId: string, dto: UploadDocDto, file: Express.Multer.File) {
    const clinic = await this.resolveClinicForUser(ownerId);
    if (!clinic) throw new NotFoundException('Clinic not found for this user');
    if (clinic.isVerified) throw new BadRequestException('Clinic is already verified');

    const uploaded = await this.cloudinary.uploadBuffer(file.buffer, `verification/clinic/${clinic.id}`);
    const doc = await this.repo.create({
      clinicId: clinic.id,
      docType: dto.docType,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      uploadedBy: ownerId,
    });

    // Mark documentsSubmitted on clinic
    await this.prisma.clinic.update({
      where: { id: clinic.id },
      data: { documentsSubmitted: true },
    });

    return doc;
  }

  async getClinicDocs(ownerId: string) {
    const clinic = await this.resolveClinicForUser(ownerId);
    if (!clinic) throw new NotFoundException('Clinic not found');
    return this.repo.findAllForClinic(clinic.id);
  }

  async deleteClinicDoc(ownerId: string, docId: string) {
    const doc = await this.repo.findById(docId);
    if (!doc || !doc.clinicId) throw new NotFoundException('Document not found');

    const clinic = await this.resolveClinicForUser(ownerId);
    if (!clinic || clinic.id !== doc.clinicId) throw new ForbiddenException('Not your document');
    if (doc.status === 'APPROVED') throw new BadRequestException('Cannot delete an approved document');

    await this.cloudinary.deleteByPublicId(doc.filePublicId);
    return this.repo.deleteDoc(docId);
  }

  // ─── SHOP_OWNER submits a doc ─────────────────────────────────────────────

  async uploadShopDoc(ownerId: string, dto: UploadDocDto, file: Express.Multer.File) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId },
      select: { id: true, isVerified: true },
    });
    if (!shop) throw new NotFoundException('Shop not found for this owner');
    if (shop.isVerified) throw new BadRequestException('Shop is already verified');

    const uploaded = await this.cloudinary.uploadBuffer(file.buffer, `verification/shop/${shop.id}`);
    const doc = await this.repo.create({
      shopId: shop.id,
      docType: dto.docType,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      uploadedBy: ownerId,
    });

    await this.prisma.shop.update({
      where: { id: shop.id },
      data: { documentsSubmitted: true },
    });

    return doc;
  }

  async getShopDocs(ownerId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId }, select: { id: true } });
    if (!shop) throw new NotFoundException('Shop not found');
    return this.repo.findAllForShop(shop.id);
  }

  async deleteShopDoc(ownerId: string, docId: string) {
    const doc = await this.repo.findById(docId);
    if (!doc || !doc.shopId) throw new NotFoundException('Document not found');

    const shop = await this.prisma.shop.findFirst({ where: { ownerId, id: doc.shopId } });
    if (!shop) throw new ForbiddenException('Not your document');
    if (doc.status === 'APPROVED') throw new BadRequestException('Cannot delete an approved document');

    await this.cloudinary.deleteByPublicId(doc.filePublicId);
    return this.repo.deleteDoc(docId);
  }

  // ─── CLINIC_OWNER uploads doctor verification doc ────────────────────────

  async uploadDoctorDoc(ownerId: string, doctorId: string, dto: UploadDocDto, file: Express.Multer.File) {
    // Verify doctor belongs to owner's clinic
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found for this owner');

    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId: clinic.id },
    });
    if (!doctor) throw new NotFoundException('Doctor not found at your clinic');

    const uploaded = await this.cloudinary.uploadBuffer(file.buffer, `verification/doctor/${doctorId}`);
    return this.repo.create({
      doctorId,
      docType: dto.docType,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      uploadedBy: ownerId,
    });
  }

  async getDoctorDocs(ownerId: string, doctorId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const doctor = await this.prisma.doctor.findFirst({ where: { id: doctorId, clinicId: clinic.id } });
    if (!doctor) throw new NotFoundException('Doctor not found at your clinic');

    return this.repo.findAllForDoctor(doctorId);
  }

  async deleteDoctorDoc(ownerId: string, docId: string) {
    const doc = await this.repo.findById(docId);
    if (!doc || !doc.doctorId) throw new NotFoundException('Document not found');

    const clinic = await this.prisma.clinic.findFirst({ where: { createdBy: ownerId, deletedAt: null } });
    if (!clinic) throw new ForbiddenException('Not your document');

    const doctor = await this.prisma.doctor.findFirst({ where: { id: doc.doctorId, clinicId: clinic.id } });
    if (!doctor) throw new ForbiddenException('Not your document');

    if (doc.status === 'APPROVED') throw new BadRequestException('Cannot delete an approved document');
    await this.cloudinary.deleteByPublicId(doc.filePublicId);
    return this.repo.deleteDoc(docId);
  }

  async getDocsForDoctorAdmin(doctorId: string) {
    return this.repo.findAllForDoctor(doctorId);
  }

  // ─── SHOP_OWNER manages delivery partner docs ─────────────────────────────

  private async resolveDeliveryPartnerForShop(ownerId: string, deliveryPartnerId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId }, select: { id: true } });
    if (!shop) throw new NotFoundException('Shop not found for this owner');

    const dp = await this.prisma.deliveryPartner.findFirst({
      where: { id: deliveryPartnerId, createdBy: ownerId },
    });
    if (!dp) throw new NotFoundException('Delivery partner not found at your shop');
    return { shop, dp };
  }

  async uploadDeliveryPartnerDoc(ownerId: string, deliveryPartnerId: string, dto: UploadDocDto, file: Express.Multer.File) {
    await this.resolveDeliveryPartnerForShop(ownerId, deliveryPartnerId);

    const uploaded = await this.cloudinary.uploadBuffer(file.buffer, `verification/delivery-partner/${deliveryPartnerId}`);
    return this.repo.create({
      deliveryPartnerId,
      docType: dto.docType,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      uploadedBy: ownerId,
    });
  }

  async getDeliveryPartnerDocs(ownerId: string, deliveryPartnerId: string) {
    await this.resolveDeliveryPartnerForShop(ownerId, deliveryPartnerId);
    return this.repo.findAllForDeliveryPartner(deliveryPartnerId);
  }

  async deleteDeliveryPartnerDoc(ownerId: string, docId: string) {
    const doc = await this.repo.findById(docId);
    if (!doc || !doc.deliveryPartnerId) throw new NotFoundException('Document not found');

    await this.resolveDeliveryPartnerForShop(ownerId, doc.deliveryPartnerId);
    if (doc.status === 'APPROVED') throw new BadRequestException('Cannot delete an approved document');

    await this.cloudinary.deleteByPublicId(doc.filePublicId);
    return this.repo.deleteDoc(docId);
  }

  // ─── SUPER_ADMIN reviews a doc ────────────────────────────────────────────

  async reviewDoc(docId: string, dto: ReviewDocDto, adminId: string) {
    const doc = await this.repo.findById(docId);
    if (!doc) throw new NotFoundException('Document not found');

    const updated = await this.repo.reviewDoc(docId, dto.action, adminId, dto.rejectedReason);

    // If all docs approved → set isVerified on parent entity
    if (dto.action === 'approve') {
      if (doc.clinicId && await this.repo.allApprovedForClinic(doc.clinicId)) {
        await this.prisma.clinic.update({ where: { id: doc.clinicId }, data: { isVerified: true } });
      }
      if (doc.shopId && await this.repo.allApprovedForShop(doc.shopId)) {
        await this.prisma.shop.update({ where: { id: doc.shopId }, data: { isVerified: true } });
      }
    }

    return updated;
  }

  async getDocsForClinicAdmin(clinicId: string) {
    return this.repo.findAllForClinic(clinicId);
  }

  async getDocsForShopAdmin(shopId: string) {
    return this.repo.findAllForShop(shopId);
  }
}
