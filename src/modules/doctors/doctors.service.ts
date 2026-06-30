import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { DayOfWeek, DoctorSpecialization } from '../../common/enums/clinic.enum';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { ClinicRepository } from '../clinics/clinic.repository';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { DoctorRepository } from './doctor.repository';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { DoctorQueryDto } from './dto/doctor-query.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { UpsertAvailabilityDto } from './dto/upsert-availability.dto';

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);

  constructor(
    private readonly doctorRepository: DoctorRepository,
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly clinicRepository: ClinicRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateDoctorDto, requesterId: string, requesterRole: string): Promise<object> {
    const isAdmin = this.isAdmin(requesterRole);

    // Resolve userId — either provided directly or derived from name/email
    let resolvedUserId = dto.userId;

    if (!resolvedUserId) {
      if (!dto.email) {
        throw new ForbiddenException('Either userId or email is required to create a doctor');
      }
      const nameParts = (dto.name ?? 'Doctor').replace(/^dr\.?\s*/i, '').trim().split(/\s+/);
      const firstName = nameParts[0] ?? 'Doctor';
      const lastName = nameParts.slice(1).join(' ') || '';
      const user = await this.usersService.findOrCreateDoctorUser({
        email: dto.email,
        firstName,
        lastName,
        phone: dto.phone,
      });
      resolvedUserId = user.id;
    } else {
      // Non-admins can only create their own profile when userId is explicit
      if (!isAdmin && resolvedUserId !== requesterId) {
        throw new ForbiddenException('You can only create your own doctor profile');
      }
      const targetUser = await this.usersService.findByIdOrThrow(resolvedUserId);
      if (targetUser.role !== UserRole.ASSISTANT && !isAdmin) {
        throw new ForbiddenException('Target user must have the ASSISTANT/DOCTOR role');
      }
    }

    const exists = await this.doctorRepository.existsByUserId(resolvedUserId);
    if (exists) throw new ConflictException('Doctor profile already exists for this user');

    // Normalize fields from frontend-friendly aliases
    const normalizedDto: CreateDoctorDto = {
      ...dto,
      userId: resolvedUserId,
      experienceYears: dto.experienceYears ?? (dto.experience != null ? Math.round(dto.experience) : 0),
      specializations: dto.specializations ??
        (dto.specialization ? [this.normalizeSpecialization(dto.specialization)] : []),
      // Strip availability string — backend expects schedule array
      availability: Array.isArray(dto.availability) ? dto.availability : undefined,
    };

    // Auto-assign clinic for clinic owners who didn't pass clinicId
    if (!normalizedDto.clinicId && !isAdmin) {
      const clinic = await this.clinicRepository.findByCreatedBy(requesterId);
      if (clinic) normalizedDto.clinicId = clinic.id;
    }

    const doctor = await this.doctorRepository.create(normalizedDto);
    this.logger.log(`Doctor profile created: ${doctor.id} for user ${resolvedUserId}`);
    return doctor;
  }

  private normalizeSpecialization(raw: string): DoctorSpecialization {
    const upper = raw.toUpperCase().replace(/\s+/g, '_');
    const valid = Object.values(DoctorSpecialization);
    // Exact match
    if (valid.includes(upper as DoctorSpecialization)) return upper as DoctorSpecialization;
    // Partial match
    const partial = valid.find(v => v.includes(upper) || upper.includes(v.replace(/_/g, '')));
    return partial ?? DoctorSpecialization.GENERAL_PRACTICE;
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async findMany(query: DoctorQueryDto, role?: string): Promise<PaginatedResponseDto<object>> {
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    const effectiveQuery: DoctorQueryDto = isSuperAdmin
      ? query
      : { ...query, verified: true };
    return this.doctorRepository.findMany(effectiveQuery);
  }

  // ─── Detail ───────────────────────────────────────────────────────────────

  async findOne(id: string, role?: string): Promise<object> {
    const doctor = await this.doctorRepository.findById(id);
    if (!doctor) throw new NotFoundException('Doctor not found');
    const isPrivileged = role === UserRole.SUPER_ADMIN || role === UserRole.CLINIC_OWNER ||
      role === UserRole.CLINIC_MANAGER || role === UserRole.RECEPTIONIST || role === UserRole.ASSISTANT;
    // Privileged clinic staff can see inactive/unverified doctors
    if (!isPrivileged && (!doctor.isActive || !doctor.isVerified)) {
      throw new NotFoundException('Doctor not found');
    }
    return doctor;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateDoctorDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<object> {
    const doctor = await this.doctorRepository.findById(id);
    if (!doctor || !doctor.isActive) throw new NotFoundException('Doctor not found');

    await this.assertOwnerOrAdmin(doctor, requesterId, requesterRole);

    const updated = await this.doctorRepository.update(id, dto);
    this.logger.log(`Doctor updated: ${id}`);
    return updated;
  }

  // ─── Verify ───────────────────────────────────────────────────────────────

  async verify(id: string, requesterRole: string): Promise<object> {
    if (!this.isAdmin(requesterRole)) {
      throw new ForbiddenException('Only admins can verify doctor profiles');
    }

    const doctor = await this.doctorRepository.findById(id);
    if (!doctor) throw new NotFoundException('Doctor not found');

    const verified = await this.doctorRepository.verify(id);

    // Activate the user account so the assistant can now log in
    await this.prisma.user.update({
      where: { id: doctor.userId },
      data: { status: 'ACTIVE' },
    });

    this.logger.log(`Doctor verified and activated: ${id}`);
    return verified;
  }

  // ─── Upload Photo ─────────────────────────────────────────────────────────

  async uploadPhoto(
    id: string,
    file: Express.Multer.File,
    requesterId: string,
    requesterRole: string,
  ): Promise<object> {
    const doctor = await this.doctorRepository.findById(id);
    if (!doctor || !doctor.isActive) throw new NotFoundException('Doctor not found');

    await this.assertOwnerOrAdmin(doctor, requesterId, requesterRole);

    if (doctor.photoPublicId) {
      await this.cloudinaryService.deleteByPublicId(doctor.photoPublicId);
    }

    const { url, publicId } = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      'pawgo/doctors/photos',
      `doctor_${id}`,
    );

    return this.doctorRepository.updatePhoto(id, url, publicId);
  }

  // ─── Clinic owner: manage doctors at their clinic ─────────────────────────

  async findMyClinicDoctors(
    userId: string,
    query: DoctorQueryDto,
    role?: string,
  ): Promise<PaginatedResponseDto<object>> {
    // Clinic owner: resolve via clinic ownership
    if (!role || role === UserRole.CLINIC_OWNER || role === UserRole.SUPER_ADMIN) {
      const clinic = await this.clinicRepository.findByCreatedBy(userId);
      if (!clinic) throw new NotFoundException('You do not have a registered clinic');
      return this.doctorRepository.findMany({ ...query, clinicId: clinic.id });
    }
    // Staff roles (RECEPTIONIST, CLINIC_MANAGER, ASSISTANT): resolve via clinicStaff table
    const staffRecord = await this.prisma.clinicStaff.findFirst({
      where: { userId },
      select: { clinicId: true },
    });
    if (!staffRecord) throw new NotFoundException('No clinic association found for this account');
    return this.doctorRepository.findMany({ ...query, clinicId: staffRecord.clinicId });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteDoctor(id: string, requesterId: string, role: string): Promise<void> {
    const doctor = await this.doctorRepository.findById(id);
    if (!doctor) throw new NotFoundException('Doctor not found');

    if (role === UserRole.SUPER_ADMIN) {
      // Admin can delete any doctor
    } else if (role === UserRole.CLINIC_OWNER) {
      const clinic = await this.clinicRepository.findByCreatedBy(requesterId);
      if (!clinic || doctor.clinicId !== clinic.id) {
        throw new ForbiddenException('You can only delete doctors at your own clinic');
      }
    } else {
      throw new ForbiddenException('Only clinic owners or admins can delete doctors');
    }

    if (doctor.photoPublicId) {
      await this.cloudinaryService.deleteByPublicId(doctor.photoPublicId);
    }

    await this.doctorRepository.deactivate(id);
    this.logger.log(`Doctor soft-deleted: ${id} by ${requesterId}`);
  }

  async deactivateByClinicOwner(
    id: string,
    ownerId: string,
    role: string,
  ): Promise<object> {
    const doctor = await this.doctorRepository.findById(id);
    if (!doctor || !doctor.isActive) throw new NotFoundException('Doctor not found');
    await this.assertOwnerOrAdminForClinic(doctor, ownerId, role);

    const deactivated = await this.doctorRepository.deactivate(id);
    this.logger.log(`Doctor deactivated by clinic owner: ${id}`);
    return deactivated;
  }

  async activateByClinicOwner(id: string, ownerId: string, role: string): Promise<object> {
    const doctor = await this.doctorRepository.findById(id);
    if (!doctor) throw new NotFoundException('Doctor not found');
    await this.assertOwnerOrAdminForClinic(doctor, ownerId, role);
    const activated = await this.doctorRepository.activate(id);
    this.logger.log(`Doctor activated by clinic owner: ${id}`);
    return activated;
  }

  // ─── Availability management ──────────────────────────────────────────────

  async getAvailability(doctorId: string): Promise<object[]> {
    const doctor = await this.doctorRepository.findById(doctorId);
    if (!doctor) throw new NotFoundException('Doctor not found');
    return this.doctorRepository.getAvailability(doctorId);
  }

  async upsertAvailability(
    doctorId: string,
    day: DayOfWeek,
    dto: UpsertAvailabilityDto,
    requesterId: string,
    role: string,
  ): Promise<object> {
    const doctor = await this.doctorRepository.findById(doctorId);
    if (!doctor) throw new NotFoundException('Doctor not found');
    await this.assertOwnerOrAdmin(doctor, requesterId, role);

    const result = await this.doctorRepository.upsertAvailability(doctorId, day, dto);
    this.logger.log(`Availability upserted for doctor ${doctorId} on ${day}`);
    return result;
  }

  async deleteAvailability(
    doctorId: string,
    day: DayOfWeek,
    requesterId: string,
    role: string,
  ): Promise<void> {
    const doctor = await this.doctorRepository.findById(doctorId);
    if (!doctor) throw new NotFoundException('Doctor not found');
    await this.assertOwnerOrAdmin(doctor, requesterId, role);

    await this.doctorRepository.deleteAvailability(doctorId, day);
    this.logger.log(`Availability removed for doctor ${doctorId} on ${day}`);
  }

  // ─── Rating aggregation (called by ReviewsService) ────────────────────────

  async recalculateRating(doctorId: string, rating: number, totalReviews: number): Promise<void> {
    await this.doctorRepository.updateRating(doctorId, rating, totalReviews);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private isAdmin(role: string): boolean {
    return role === UserRole.SUPER_ADMIN;
  }

  private async assertOwnerOrAdmin(
    doctor: { userId: string; clinicId: string | null },
    requesterId: string,
    role: string,
  ): Promise<void> {
    if (this.isAdmin(role)) return;
    if (doctor.userId === requesterId) return;
    if (role === UserRole.CLINIC_OWNER) {
      const clinic = await this.clinicRepository.findByCreatedBy(requesterId);
      if (clinic && doctor.clinicId === clinic.id) return;
    }
    throw new ForbiddenException('You do not have permission to manage this doctor profile');
  }

  private async assertOwnerOrAdminForClinic(
    doctor: { clinicId: string | null },
    ownerId: string,
    role: string,
  ): Promise<void> {
    if (this.isAdmin(role)) return;
    if (role === UserRole.CLINIC_OWNER) {
      const clinic = await this.clinicRepository.findByCreatedBy(ownerId);
      if (clinic && doctor.clinicId === clinic.id) return;
    }
    throw new ForbiddenException('You can only manage doctors at your own clinic');
  }
}
