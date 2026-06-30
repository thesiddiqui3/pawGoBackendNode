import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { EMAIL_SERVICE, IEmailService } from '../../shared/email/email.interface';
import { emailTemplates } from '../../shared/email/email-templates';
import { AssignDoctorDto, CancelHomeVisitDto, CreateHomeVisitDto } from './dto/create-home-visit.dto';

const INCLUDE_FULL = {
  clinic: { select: { id: true, name: true, phone: true } },
  doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
  pet: { select: { id: true, name: true, species: true, breed: true } },
  owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
};

@Injectable()
export class HomeVisitsService {
  private readonly logger = new Logger(HomeVisitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateHomeVisitDto, userId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: dto.clinicId },
      select: { id: true, isVerified: true, isActive: true, deletedAt: true },
    });
    if (!clinic || clinic.deletedAt || !clinic.isActive || !clinic.isVerified) {
      throw new NotFoundException('Clinic not found or not available for home visits');
    }

    const pet = await this.prisma.pet.findUnique({ where: { id: dto.petId } });
    if (!pet || pet.deletedAt) throw new NotFoundException('Pet not found');
    if (pet.ownerId !== userId) throw new ForbiddenException('You do not own this pet');

    return this.prisma.homeVisit.create({
      data: {
        clinicId: dto.clinicId,
        petId: dto.petId,
        ownerId: userId,
        address: dto.address,
        city: dto.city,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
        createdBy: userId,
      },
      include: INCLUDE_FULL,
    });
  }

  // ─── My requests (pet owner) ──────────────────────────────────────────────

  async findMine(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.homeVisit.findMany({
        where: { ownerId: userId },
        include: INCLUDE_FULL,
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.homeVisit.count({ where: { ownerId: userId } }),
    ]);
    return { data, total, page, limit };
  }

  // ─── Clinic view ──────────────────────────────────────────────────────────

  async findAll(status?: string, search?: string, clinicId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      ...(clinicId ? { clinicId } : {}),
      ...(status ? { status: status.toUpperCase() } : {}),
      ...(search ? {
        OR: [
          { owner: { firstName: { contains: search, mode: 'insensitive' } } },
          { owner: { lastName: { contains: search, mode: 'insensitive' } } },
          { pet: { name: { contains: search, mode: 'insensitive' } } },
          { address: { contains: search, mode: 'insensitive' } },
          { clinic: { name: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    };

    const [data, total, statusCounts] = await this.prisma.$transaction([
      this.prisma.homeVisit.findMany({
        where,
        include: { ...INCLUDE_FULL, clinic: { select: { id: true, name: true, phone: true } } },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.homeVisit.count({ where }),
      this.prisma.homeVisit.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(statusCounts.map(s => [s.status.toLowerCase(), (s._count as Record<string, number>)._all ?? 0]));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1, statusCounts: counts };
  }

  async findForClinic(userId: string, role: string, status?: string, page = 1, limit = 20) {
    const clinicId = await this.resolveClinicId(userId, role);
    const skip = (page - 1) * limit;

    const where: any = { clinicId, ...(status && { status }) };

    const [data, total, statusCounts] = await this.prisma.$transaction([
      this.prisma.homeVisit.findMany({
        where,
        include: INCLUDE_FULL,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.homeVisit.count({ where }),
      this.prisma.homeVisit.groupBy({
        by: ['status'],
        where: { clinicId: where.clinicId },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(statusCounts.map(s => [s.status.toLowerCase(), (s._count as Record<string, number>)._all ?? 0]));
    const totalPages = Math.ceil(total / limit) || 1;
    return { data, total, totalPages, page, pageSize: limit, statusCounts: counts };
  }

  // ─── Detail ───────────────────────────────────────────────────────────────

  async findOne(id: string, userId: string, role: string) {
    const visit = await this.prisma.homeVisit.findUnique({ where: { id }, include: INCLUDE_FULL });
    if (!visit) throw new NotFoundException('Home visit not found');

    const isAdmin = role === UserRole.SUPER_ADMIN;
    const isOwner = visit.ownerId === userId;
    const isClinicStaff = await this.isClinicStaff(visit.clinicId, userId, role);

    if (!isAdmin && !isOwner && !isClinicStaff) {
      throw new ForbiddenException('Access denied');
    }
    return visit;
  }

  // ─── Assign Doctor ────────────────────────────────────────────────────────

  async assignDoctor(id: string, dto: AssignDoctorDto, userId: string, role: string) {
    const visit = await this.getClinicVisitOrThrow(id, userId, role);

    const doctor = await this.prisma.doctor.findFirst({
      where: { id: dto.doctorId, clinicId: visit.clinicId, isActive: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found at this clinic');

    const updated = await this.prisma.homeVisit.update({
      where: { id },
      data: { doctorId: dto.doctorId, fee: dto.fee, status: 'ASSIGNED', assignedAt: new Date() },
      include: INCLUDE_FULL,
    });

    this.sendHomeVisitConfirmedEmail(updated as any).catch((err) =>
      this.logger.error(`homeVisitConfirmed email failed for ${id}: ${err?.message}`),
    );

    return updated;
  }

  private async sendHomeVisitConfirmedEmail(visit: any): Promise<void> {
    const owner = visit.owner;
    if (!owner?.email) return;

    const doctorName = visit.doctor?.user
      ? `Dr. ${visit.doctor.user.firstName} ${visit.doctor.user.lastName}`
      : 'Assigned Doctor';

    const scheduledAt = new Date(visit.scheduledAt).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const html = emailTemplates.homeVisitConfirmed(
      owner.firstName ?? 'Customer',
      visit.pet?.name ?? 'your pet',
      visit.clinic?.name ?? 'Clinic',
      doctorName,
      scheduledAt,
      visit.address ?? '',
      visit.fee ?? 0,
    );

    await this.emailService.send({
      to: owner.email,
      subject: `Home Visit Confirmed — ${visit.pet?.name ?? 'Your Pet'}`,
      html,
    });
  }

  // ─── Start ────────────────────────────────────────────────────────────────

  async start(id: string, userId: string, role: string) {
    await this.getClinicVisitOrThrow(id, userId, role);
    return this.prisma.homeVisit.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
      include: INCLUDE_FULL,
    });
  }

  // ─── Complete ─────────────────────────────────────────────────────────────

  async complete(id: string, userId: string, role: string) {
    await this.getClinicVisitOrThrow(id, userId, role);
    return this.prisma.homeVisit.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: INCLUDE_FULL,
    });
  }

  // ─── Cancel ───────────────────────────────────────────────────────────────

  async cancel(id: string, dto: CancelHomeVisitDto, userId: string, role: string) {
    const visit = await this.prisma.homeVisit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException('Home visit not found');

    const isOwner = visit.ownerId === userId;
    const isClinicStaff = await this.isClinicStaff(visit.clinicId, userId, role);
    const isAdmin = role === UserRole.SUPER_ADMIN;

    if (!isOwner && !isClinicStaff && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.homeVisit.update({
      where: { id },
      data: { status: 'CANCELLED', cancelReason: dto.reason, cancelledAt: new Date() },
      include: INCLUDE_FULL,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async resolveClinicId(userId: string, role: string): Promise<string> {
    if (role === UserRole.SUPER_ADMIN) throw new NotFoundException('Admin must pass clinicId');
    const owned = await this.prisma.clinic.findFirst({ where: { createdBy: userId, deletedAt: null } });
    if (owned) return owned.id;
    const staff = await this.prisma.clinicStaff.findUnique({ where: { userId }, select: { clinicId: true } });
    if (staff) return staff.clinicId;
    throw new NotFoundException('You are not associated with a clinic');
  }

  private async isClinicStaff(clinicId: string, userId: string, role: string): Promise<boolean> {
    if (role === UserRole.SUPER_ADMIN) return true;
    const owned = await this.prisma.clinic.findFirst({ where: { id: clinicId, createdBy: userId } });
    if (owned) return true;
    const staff = await this.prisma.clinicStaff.findFirst({ where: { clinicId, userId } });
    return !!staff;
  }

  private async getClinicVisitOrThrow(id: string, userId: string, role: string) {
    const visit = await this.prisma.homeVisit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException('Home visit not found');
    const ok = await this.isClinicStaff(visit.clinicId, userId, role);
    if (!ok) throw new ForbiddenException('Access denied');
    return visit;
  }
}
