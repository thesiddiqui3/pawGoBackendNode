import { Injectable } from '@nestjs/common';
import { Prescription, PrescriptionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

const PRESCRIPTION_INCLUDE = {
  pet: { select: { id: true, name: true, species: true, breed: true } },
  clinic: { select: { id: true, name: true, phone: true, address: true, city: true } },
  doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
} as const;

@Injectable()
export class PrescriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePrescriptionDto, createdBy: string): Promise<Prescription> {
    const firstMed = dto.medicines?.[0];
    return this.prisma.prescription.create({
      data: {
        ...(dto.petId    && { pet:    { connect: { id: dto.petId    } } }),
        ...(dto.clinicId && { clinic: { connect: { id: dto.clinicId } } }),
        ...(dto.doctorId && { doctor: { connect: { id: dto.doctorId } } }),
        ...(dto.recordId && { record: { connect: { id: dto.recordId } } }),
        walkinPatientName: dto.patientName,
        walkinPetName:     dto.petName,
        walkinPetType:     dto.petType,
        diagnosis:    dto.diagnosis,
        medicines:    dto.medicines as unknown as import('@prisma/client').Prisma.InputJsonValue ?? [],
        medicineName: firstMed?.name ?? '',
        dosage:       firstMed?.dosage ?? '',
        frequency:    firstMed?.frequency ?? firstMed?.instructions ?? '',
        duration:     firstMed?.duration ?? '',
        instructions: firstMed?.instructions,
        expiresAt:    dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        notes:        dto.notes,
        createdBy,
      },
      include: PRESCRIPTION_INCLUDE,
    });
  }

  async findMany(query: PrescriptionQueryDto, clinicIds?: string[]) {
    const { page = 1, limit = 20, petId, clinicId, doctorId, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (petId) where.petId = petId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    if (clinicId) {
      where.clinicId = clinicId;
    } else if (clinicIds?.length) {
      where.clinicId = { in: clinicIds };
    }

    const [data, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        include: PRESCRIPTION_INCLUDE,
        orderBy: { prescribedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.prescription.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    return this.prisma.prescription.findUnique({
      where: { id },
      include: PRESCRIPTION_INCLUDE,
    });
  }

  async findByPet(petId: string, clinicId?: string) {
    return this.prisma.prescription.findMany({
      where: { petId, ...(clinicId ? { clinicId } : {}) },
      include: PRESCRIPTION_INCLUDE,
      orderBy: { prescribedAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdatePrescriptionDto, updatedBy: string) {
    return this.prisma.prescription.update({
      where: { id },
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        updatedBy,
        updatedAt: new Date(),
      },
      include: PRESCRIPTION_INCLUDE,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.prescription.delete({ where: { id } });
  }

  async expireOverdue(): Promise<number> {
    const result = await this.prisma.prescription.updateMany({
      where: {
        status: PrescriptionStatus.ACTIVE,
        expiresAt: { lt: new Date() },
      },
      data: { status: PrescriptionStatus.EXPIRED },
    });
    return result.count;
  }
}
