import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { DayOfWeek } from '../../common/enums/clinic.enum';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { ClinicRepository } from '../clinics/clinic.repository';
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
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateDoctorDto, requesterId: string, requesterRole: string): Promise<object> {
    const isAdmin = this.isAdmin(requesterRole);

    // Non-admins can only create their own profile
    if (!isAdmin && dto.userId !== requesterId) {
      throw new ForbiddenException('You can only create your own doctor profile');
    }

    const targetUser = await this.usersService.findByIdOrThrow(dto.userId);
    if (targetUser.role !== UserRole.ASSISTANT && !isAdmin) {
      throw new ForbiddenException('Target user must have the DOCTOR role');
    }

    const exists = await this.doctorRepository.existsByUserId(dto.userId);
    if (exists) throw new ConflictException('Doctor profile already exists for this user');

    const doctor = await this.doctorRepository.create(dto);
    this.logger.log(`Doctor profile created: ${doctor.id} for user ${dto.userId}`);
    return doctor;
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async findMany(query: DoctorQueryDto): Promise<PaginatedResponseDto<object>> {
    return this.doctorRepository.findMany(query);
  }

  // ─── Detail ───────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<object> {
    const doctor = await this.doctorRepository.findById(id);
    if (!doctor || !doctor.isActive) throw new NotFoundException('Doctor not found');
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

    this.assertOwnerOrAdmin(doctor, requesterId, requesterRole);

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
    this.logger.log(`Doctor verified: ${id}`);
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

    this.assertOwnerOrAdmin(doctor, requesterId, requesterRole);

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
    ownerId: string,
    query: DoctorQueryDto,
  ): Promise<PaginatedResponseDto<object>> {
    const clinic = await this.clinicRepository.findByCreatedBy(ownerId);
    if (!clinic) throw new NotFoundException('You do not have a registered clinic');
    return this.doctorRepository.findMany({ ...query, clinicId: clinic.id });
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

  private assertOwnerOrAdmin(
    doctor: { userId: string },
    requesterId: string,
    role: string,
  ): void {
    if (this.isAdmin(role)) return;
    if (doctor.userId === requesterId) return;
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
