import { Injectable } from '@nestjs/common';
import { MedicalRecord, Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PrismaService } from '../../database/prisma.service';
import { MedicalRecordQueryDto } from './dto/medical-record-query.dto';
import { PrescriptionDto } from './dto/prescription.dto';

// ─── Relation includes ────────────────────────────────────────────────────────

const RECORD_INCLUDE = {
  pet: {
    select: { id: true, name: true, species: true, breed: true, photoUrl: true },
  },
  doctor: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
      specializations: true,
    },
  },
  clinic: {
    select: { id: true, name: true, slug: true, city: true, logoUrl: true },
  },
  appointment: {
    select: { id: true, appointmentNumber: true, appointmentDate: true },
  },
  prescriptions: true,
  attachments: true,
} satisfies Prisma.MedicalRecordInclude;

export type MedicalRecordDetail = Prisma.MedicalRecordGetPayload<{
  include: typeof RECORD_INCLUDE;
}>;

// ─── Repository ───────────────────────────────────────────────────────────────

@Injectable()
export class MedicalRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Record<string, unknown>,
    prescriptions: PrescriptionDto[],
    context?: { petId: string; clinicId: string; createdBy: string },
  ): Promise<MedicalRecordDetail> {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.medicalRecord.create({ data: data as any, include: RECORD_INCLUDE });
      if (prescriptions.length > 0 && context) {
        await tx.prescription.createMany({
          data: prescriptions.map((p) => ({
            ...p,
            recordId: record.id,
            petId: context.petId,
            clinicId: context.clinicId,
            createdBy: context.createdBy,
          })),
        });
        // reload to include prescriptions
        return tx.medicalRecord.findUniqueOrThrow({ where: { id: record.id }, include: RECORD_INCLUDE });
      }
      return record;
    });
  }

  async findById(id: string): Promise<MedicalRecordDetail | null> {
    return this.prisma.medicalRecord.findUnique({ where: { id }, include: RECORD_INCLUDE });
  }

  async findRaw(id: string): Promise<MedicalRecord | null> {
    return this.prisma.medicalRecord.findUnique({ where: { id } });
  }

  async findMany(query: MedicalRecordQueryDto): Promise<PaginatedResponseDto<MedicalRecordDetail>> {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    const where: Prisma.MedicalRecordWhereInput = {
      ...(query.petId && { petId: query.petId }),
      ...(query.doctorId && { doctorId: query.doctorId }),
      ...(query.clinicId && { clinicId: query.clinicId }),
      ...((query.dateFrom || query.dateTo) && {
        visitDate: {
          ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
          ...(query.dateTo && { lte: new Date(query.dateTo) }),
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.medicalRecord.findMany({
        where,
        skip,
        take,
        orderBy: { visitDate: 'desc' },
        include: RECORD_INCLUDE,
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async findByPet(petId: string): Promise<MedicalRecordDetail[]> {
    return this.prisma.medicalRecord.findMany({
      where: { petId },
      orderBy: { visitDate: 'desc' },
      include: RECORD_INCLUDE,
    });
  }

  async update(
    id: string,
    data: Prisma.MedicalRecordUpdateInput,
    prescriptions?: PrescriptionDto[],
    context?: { petId: string; clinicId: string; createdBy: string },
  ): Promise<MedicalRecordDetail> {
    return this.prisma.$transaction(async (tx) => {
      if (prescriptions !== undefined) {
        // Replace prescriptions: delete all existing, create new ones
        await tx.prescription.deleteMany({ where: { recordId: id } });
        if (context) {
          await tx.prescription.createMany({
            data: prescriptions.map((p) => ({
              ...p,
              recordId: id,
              petId: context.petId,
              clinicId: context.clinicId,
              createdBy: context.createdBy,
            })),
          });
        }
      }
      return tx.medicalRecord.update({
        where: { id },
        data,
        include: RECORD_INCLUDE,
      });
    });
  }

  async addAttachment(
    recordId: string,
    url: string,
    publicId: string,
    fileType: string,
    fileName?: string,
  ): Promise<MedicalRecordDetail> {
    return this.prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        attachments: {
          create: { url, publicId, fileType: fileType as any, fileName },
        },
      },
      include: RECORD_INCLUDE,
    });
  }

  async removeAttachment(attachmentId: string): Promise<void> {
    await this.prisma.medicalAttachment.delete({ where: { id: attachmentId } });
  }

  async findAttachment(attachmentId: string) {
    return this.prisma.medicalAttachment.findUnique({ where: { id: attachmentId } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.medicalRecord.delete({ where: { id } });
  }

  async findLastVisit(petId: string): Promise<MedicalRecordDetail | null> {
    const records = await this.prisma.medicalRecord.findMany({
      where: { petId },
      orderBy: { visitDate: 'desc' },
      take: 1,
      include: RECORD_INCLUDE,
    });
    return records[0] ?? null;
  }

  async findActiveTreatments(petId: string): Promise<MedicalRecordDetail[]> {
    return this.prisma.medicalRecord.findMany({
      where: {
        petId,
        followUpDate: { gte: new Date() },
      },
      orderBy: { followUpDate: 'asc' },
      include: RECORD_INCLUDE,
    });
  }
}
