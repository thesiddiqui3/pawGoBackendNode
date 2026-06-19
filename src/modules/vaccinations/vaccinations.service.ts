import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { REMINDER_OFFSETS, ReminderStatus, ReminderType } from '../../common/enums/medical.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { PrismaService } from '../../database/prisma.service';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { PetRepository } from '../pets/pet.repository';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { UpcomingVaccinationsQueryDto, VaccinationQueryDto } from './dto/vaccination-query.dto';
import { VaccinationDetail, VaccinationRepository } from './vaccination.repository';

@Injectable()
export class VaccinationsService {
  private readonly logger = new Logger(VaccinationsService.name);

  constructor(
    private readonly vaccinationRepository: VaccinationRepository,
    private readonly petRepository: PetRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Create + generate reminders ─────────────────────────────────────────

  async create(
    dto: CreateVaccinationDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<VaccinationDetail> {
    // ── Validate petId if provided ───────────────────────────────────────────
    if (dto.petId) {
      const pet = await this.petRepository.findById(dto.petId);
      if (!pet || pet.deletedAt) throw new NotFoundException('Pet not found');
    }

    // ── Auto-resolve clinicId ────────────────────────────────────────────────
    let resolvedClinicId = dto.clinicId;
    if (!resolvedClinicId && !this.isAdmin(requesterRole)) {
      const clinic = await this.prisma.clinic.findFirst({ where: { createdBy: requesterId, deletedAt: null } });
      if (clinic) resolvedClinicId = clinic.id;
      else {
        const staff = await this.prisma.clinicStaff.findUnique({ where: { userId: requesterId }, select: { clinicId: true } });
        if (staff) resolvedClinicId = staff.clinicId;
      }
    }

    // ── Resolve doctorId ─────────────────────────────────────────────────────
    let resolvedDoctorId: string | null = dto.doctorId ?? null;
    if (!resolvedDoctorId) {
      resolvedDoctorId = await this.resolveDoctorId(requesterId, requesterRole);
    }

    const createData: Record<string, unknown> = {
      vaccineName: dto.vaccineName,
      vaccineType: dto.vaccineType,
      manufacturer: dto.manufacturer,
      batchNumber: dto.batchNumber,
      dateAdministered: new Date(dto.dateAdministered),
      nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : undefined,
      walkinPetName: dto.petName,
      walkinPetType: dto.petType,
      walkinOwnerName: dto.ownerName,
      walkinOwnerPhone: dto.ownerPhone,
      notes: dto.notes,
      createdBy: requesterId,
    };
    if (dto.petId) createData.pet = { connect: { id: dto.petId } };
    if (resolvedDoctorId) createData.doctor = { connect: { id: resolvedDoctorId } };
    if (resolvedClinicId) createData.clinic = { connect: { id: resolvedClinicId } };

    const vaccination = await this.vaccinationRepository.create(createData as Parameters<VaccinationRepository['create']>[0]);

    // Generate reminders if nextDueDate is set and pet owner is known
    if (dto.nextDueDate && dto.petId) {
      const pet = await this.petRepository.findById(dto.petId);
      if (pet) await this.generateReminders(vaccination.id, pet.ownerId, dto.petId, new Date(dto.nextDueDate), dto.vaccineName);
    }

    this.logger.log(`Vaccination created: ${vaccination.id}`);
    return vaccination;
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  async findMany(
    query: VaccinationQueryDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<PaginatedResponseDto<VaccinationDetail>> {
    if (this.isAdmin(requesterRole) || requesterRole === UserRole.ASSISTANT) {
      return this.vaccinationRepository.findMany(query);
    }
    // Pet owner: only see their pets' vaccinations
    if (query.petId) {
      await this.assertPetAccess(query.petId, requesterId);
    }
    return this.vaccinationRepository.findMany(query);
  }

  // ─── Pet vaccinations timeline ─────────────────────────────────────────────

  async findByPet(
    petId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<VaccinationDetail[]> {
    await this.assertPetAccess(petId, requesterId, requesterRole);
    return this.vaccinationRepository.findByPet(petId);
  }

  // ─── Upcoming vaccinations ─────────────────────────────────────────────────

  async findUpcoming(
    query: UpcomingVaccinationsQueryDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<VaccinationDetail[]> {
    const days = query.days ?? 30;

    if (this.isAdmin(requesterRole) || requesterRole === UserRole.ASSISTANT) {
      return this.vaccinationRepository.findUpcoming(days, query.petId);
    }

    // Pet owner: scope to their pets
    if (query.petId) {
      await this.assertPetAccess(query.petId, requesterId);
      return this.vaccinationRepository.findUpcoming(days, query.petId);
    }

    // Return upcoming for all of requester's pets
    const pets = await this.prisma.pet.findMany({
      where: { ownerId: requesterId, deletedAt: null },
      select: { id: true },
    });
    const now = new Date();
    const future = new Date(now.getTime() + days * 86_400_000);
    return this.prisma.vaccination.findMany({
      where: {
        petId: { in: pets.map((p) => p.id) },
        nextDueDate: { gte: now, lte: future },
      },
      orderBy: { nextDueDate: 'asc' },
      include: {
        pet: { select: { id: true, name: true, species: true, breed: true, ownerId: true } },
        doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        clinic: { select: { id: true, name: true, city: true } },
        reminders: { orderBy: { scheduledFor: 'asc' } },
      },
    }) as unknown as VaccinationDetail[];
  }

  // ─── Detail ────────────────────────────────────────────────────────────────

  async findOne(
    id: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<VaccinationDetail> {
    const v = await this.vaccinationOrThrow(id);
    await this.assertPetAccess(v.petId ?? '', requesterId, requesterRole);
    return v;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateVaccinationDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<VaccinationDetail> {
    const v = await this.vaccinationOrThrow(id);
    await this.assertWriteAccess(v, requesterId, requesterRole);

    const updated = await this.vaccinationRepository.update(id, {
      ...(dto.manufacturer !== undefined && { manufacturer: dto.manufacturer }),
      ...(dto.batchNumber !== undefined && { batchNumber: dto.batchNumber }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.nextDueDate !== undefined && {
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
      }),
    });

    // Regenerate reminders if nextDueDate changed
    if (dto.nextDueDate && updated.nextDueDate) {
      const pet = await this.petRepository.findById(updated.petId ?? '');
      if (pet) {
        // Cancel old reminders first
        await this.prisma.vaccinationReminder.updateMany({
          where: { vaccinationId: id, status: ReminderStatus.PENDING },
          data: { status: ReminderStatus.CANCELLED },
        });
        await this.generateReminders(id, pet.ownerId, pet.id, updated.nextDueDate, updated.vaccineName);
      }
    }

    this.logger.log(`Vaccination updated: ${id}`);
    return updated;
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async remove(id: string, requesterId: string, requesterRole: string): Promise<void> {
    const v = await this.vaccinationOrThrow(id);
    await this.assertWriteAccess(v, requesterId, requesterRole);

    if (v.certificatePublicId) {
      await this.cloudinaryService.deleteByPublicId(v.certificatePublicId).catch(() => null);
    }

    await this.vaccinationRepository.delete(id);
    this.logger.log(`Vaccination deleted: ${id}`);
  }

  // ─── Upload certificate ────────────────────────────────────────────────────

  async uploadCertificate(
    id: string,
    file: Express.Multer.File,
    requesterId: string,
    requesterRole: string,
  ): Promise<VaccinationDetail> {
    const v = await this.vaccinationOrThrow(id);
    await this.assertWriteAccess(v, requesterId, requesterRole);

    if (v.certificatePublicId) {
      await this.cloudinaryService.deleteByPublicId(v.certificatePublicId).catch(() => null);
    }

    const { url, publicId } = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      'pawgo/vaccinations/certificates',
      `cert_${id}`,
    );

    const updated = await this.vaccinationRepository.update(id, {
      certificateUrl: url,
      certificatePublicId: publicId,
    });

    this.logger.log(`Certificate uploaded for vaccination ${id}`);
    return updated;
  }

  // ─── Reminders list ────────────────────────────────────────────────────────

  async findReminders(requesterId: string, requesterRole: string) {
    if (this.isAdmin(requesterRole)) {
      return this.vaccinationRepository.findReminders({ status: ReminderStatus.PENDING });
    }
    return this.vaccinationRepository.findReminders({
      userId: requesterId,
      status: ReminderStatus.PENDING,
    });
  }

  // ─── Pet vaccination summary (used by health summary) ─────────────────────

  async getPetVaccinationSummary(
    petId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<object> {
    await this.assertPetAccess(petId, requesterId, requesterRole);
    const [lastVaccination, upcomingVaccinations] = await Promise.all([
      this.vaccinationRepository.findLastVaccination(petId),
      this.vaccinationRepository.findUpcoming(90, petId),
    ]);
    return { lastVaccination, upcomingVaccinations };
  }

  // ─── Reminder engine ───────────────────────────────────────────────────────

  private async generateReminders(
    vaccinationId: string,
    userId: string,
    petId: string,
    dueDate: Date,
    vaccineName: string,
  ): Promise<void> {
    const now = new Date();
    const reminders: Parameters<VaccinationRepository['createReminders']>[0] = [];

    for (const [type, offsetDays] of Object.entries(REMINDER_OFFSETS) as [ReminderType, number][]) {
      const scheduledFor = new Date(dueDate.getTime() - offsetDays * 86_400_000);
      if (scheduledFor <= now) continue; // skip past dates

      const label =
        type === ReminderType.DUE_DATE
          ? 'due today'
          : `due in ${offsetDays} day${offsetDays === 1 ? '' : 's'}`;

      reminders.push({
        userId,
        petId,
        vaccinationId,
        type,
        message: `Reminder: ${vaccineName} vaccination is ${label}`,
        scheduledFor,
        status: ReminderStatus.PENDING,
      });
    }

    if (reminders.length > 0) {
      await this.vaccinationRepository.createReminders(reminders);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private isAdmin(role: string): boolean {
    return role === UserRole.SUPER_ADMIN;
  }

  private async resolveDoctorId(requesterId: string, role: string): Promise<string | null> {
    if (this.isAdmin(role)) return null;
    if (role === UserRole.ASSISTANT) {
      const profile = await this.prisma.doctor.findUnique({
        where: { userId: requesterId },
        select: { id: true },
      });
      return profile?.id ?? null;
    }
    return null;
  }

  private async assertPetAccess(
    petId: string,
    requesterId: string,
    requesterRole?: string,
  ): Promise<void> {
    if (requesterRole && (this.isAdmin(requesterRole) || requesterRole === UserRole.ASSISTANT)) return;
    const pet = await this.petRepository.findById(petId);
    if (!pet || pet.deletedAt) throw new NotFoundException('Pet not found');
    if (pet.ownerId !== requesterId) throw new ForbiddenException('Access denied');
  }

  private async assertWriteAccess(
    vaccination: VaccinationDetail,
    requesterId: string,
    requesterRole: string,
  ): Promise<void> {
    if (this.isAdmin(requesterRole)) return;

    if (requesterRole === UserRole.ASSISTANT) {
      const profile = await this.prisma.doctor.findUnique({
        where: { userId: requesterId },
        select: { id: true },
      });
      if (profile && vaccination.doctorId === profile.id) return;
      throw new ForbiddenException('You can only modify vaccinations you administered');
    }

    // Clinic managers and owners can manage vaccinations at their clinic
    if (requesterRole === UserRole.CLINIC_MANAGER || requesterRole === UserRole.CLINIC_OWNER) {
      const clinicId = await this.resolveStaffClinicId(requesterId);
      if (clinicId && vaccination.clinicId === clinicId) return;
      throw new ForbiddenException('You can only manage vaccinations at your own clinic');
    }

    throw new ForbiddenException('Only doctors and admins can modify vaccination records');
  }

  private async resolveStaffClinicId(userId: string): Promise<string | null> {
    const owned = await this.prisma.clinic.findFirst({
      where: { createdBy: userId, deletedAt: null },
      select: { id: true },
    });
    if (owned) return owned.id;
    const staff = await this.prisma.clinicStaff.findUnique({
      where: { userId },
      select: { clinicId: true },
    });
    return staff?.clinicId ?? null;
  }

  private async vaccinationOrThrow(id: string): Promise<VaccinationDetail> {
    const v = await this.vaccinationRepository.findById(id);
    if (!v) throw new NotFoundException('Vaccination not found');
    return v;
  }
}
