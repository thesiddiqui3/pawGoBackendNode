import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';

@Injectable()
export class ClinicPatientsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveClinicId(userId: string, role: string): Promise<string> {
    if (role === UserRole.SUPER_ADMIN) throw new NotFoundException('Use clinicId query param for admin');
    // Try clinic owner first
    const owned = await this.prisma.clinic.findFirst({
      where: { createdBy: userId, deletedAt: null },
      select: { id: true },
    });
    if (owned) return owned.id;

    // Try staff record
    const staff = await this.prisma.clinicStaff.findUnique({
      where: { userId },
      select: { clinicId: true },
    });
    if (staff) return staff.clinicId;

    throw new NotFoundException('You are not associated with a clinic');
  }

  // ─── List all pets that visited the clinic ───────────────────────────────

  async listPatients(userId: string, role: string, clinicId?: string, page = 1, limit = 20) {
    const cid = clinicId ?? await this.resolveClinicId(userId, role);

    const skip = (page - 1) * limit;

    const [pets, total] = await this.prisma.$transaction([
      this.prisma.pet.findMany({
        where: {
          deletedAt: null,
          OR: [
            { appointments: { some: { clinicId: cid } } },
            { medicalRecords: { some: { clinicId: cid } } },
            { vaccinations: { some: { clinicId: cid } } },
          ],
        },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          _count: { select: { appointments: true, medicalRecords: true, vaccinations: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pet.count({
        where: {
          deletedAt: null,
          OR: [
            { appointments: { some: { clinicId: cid } } },
            { medicalRecords: { some: { clinicId: cid } } },
            { vaccinations: { some: { clinicId: cid } } },
          ],
        },
      }),
    ]);

    return { data: pets, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── List pet owners who visited ─────────────────────────────────────────

  async listOwners(userId: string, role: string, clinicId?: string, page = 1, limit = 20, search?: string) {
    const cid = clinicId ?? await this.resolveClinicId(userId, role);
    const skip = (page - 1) * limit;

    const searchFilter = search?.trim()
      ? {
          OR: [
            { firstName: { contains: search.trim(), mode: 'insensitive' as const } },
            { lastName: { contains: search.trim(), mode: 'insensitive' as const } },
            { phone: { contains: search.trim() } },
            { email: { contains: search.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const clinicFilter = {
      pets: { some: { appointments: { some: { clinicId: cid } } } },
    };

    const where = { deletedAt: null, ...clinicFilter, ...searchFilter };

    const [owners, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          _count: { select: { pets: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: owners, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Get pet profile ──────────────────────────────────────────────────────

  async getPetProfile(petId: string, userId: string, role: string, clinicId?: string) {
    const cid = clinicId ?? await this.resolveClinicId(userId, role);

    const pet = await this.prisma.pet.findFirst({
      where: {
        id: petId,
        deletedAt: null,
        OR: [
          { appointments: { some: { clinicId: cid } } },
          { medicalRecords: { some: { clinicId: cid } } },
          { vaccinations: { some: { clinicId: cid } } },
        ],
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, avatarUrl: true } },
        gallery: true,
        _count: { select: { appointments: true, medicalRecords: true, vaccinations: true } },
      },
    });

    if (!pet) throw new NotFoundException('Patient not found at this clinic');
    return pet;
  }

  // ─── Get all visits at this clinic ───────────────────────────────────────

  async getPetVisits(petId: string, userId: string, role: string, clinicId?: string, page = 1, limit = 20) {
    const cid = clinicId ?? await this.resolveClinicId(userId, role);
    const skip = (page - 1) * limit;

    const [appointments, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where: { petId, clinicId: cid },
        include: {
          doctor: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          appointmentNote: true,
        },
        skip,
        take: limit,
        orderBy: { appointmentDate: 'desc' },
      }),
      this.prisma.appointment.count({ where: { petId, clinicId: cid } }),
    ]);

    return { data: appointments, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Get medical history at this clinic ──────────────────────────────────

  async getMedicalHistory(petId: string, userId: string, role: string, clinicId?: string) {
    const cid = clinicId ?? await this.resolveClinicId(userId, role);

    return this.prisma.medicalRecord.findMany({
      where: { petId, clinicId: cid },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        prescriptions: true,
        attachments: true,
      },
      orderBy: { visitDate: 'desc' },
    });
  }

  // ─── Get vaccinations at this clinic ─────────────────────────────────────

  async getVaccinationHistory(petId: string, userId: string, role: string, clinicId?: string) {
    const cid = clinicId ?? await this.resolveClinicId(userId, role);

    return this.prisma.vaccination.findMany({
      where: { petId, clinicId: cid },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { dateAdministered: 'desc' },
    });
  }
}
