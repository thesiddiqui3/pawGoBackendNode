import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { MIME_TO_ATTACHMENT_TYPE } from '../../common/enums/medical.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { PrismaService } from '../../database/prisma.service';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { PetRepository } from '../pets/pet.repository';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { MedicalRecordQueryDto } from './dto/medical-record-query.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { MedicalRecordDetail, MedicalRecordRepository } from './medical-record.repository';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  constructor(
    private readonly recordRepository: MedicalRecordRepository,
    private readonly petRepository: PetRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(
    dto: CreateMedicalRecordDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<MedicalRecordDetail> {
    const doctorId = await this.resolveDoctorId(requesterId, requesterRole, dto.clinicId);

    const pet = await this.petRepository.findById(dto.petId);
    if (!pet || pet.deletedAt) throw new NotFoundException('Pet not found');

    const record = await this.recordRepository.create(
      {
        pet: { connect: { id: dto.petId } },
        doctor: { connect: { id: doctorId } },
        clinic: { connect: { id: dto.clinicId } },
        ...(dto.appointmentId && { appointment: { connect: { id: dto.appointmentId } } }),
        visitDate: new Date(dto.visitDate),
        chiefComplaint: dto.chiefComplaint,
        symptoms: dto.symptoms ?? [],
        diagnosis: dto.diagnosis ?? [],
        treatmentPlan: dto.treatmentPlan,
        notes: dto.notes,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
        createdBy: requesterId,
      },
      dto.prescriptions ?? [],
    );

    this.logger.log(`Medical record created: ${record.id} for pet ${dto.petId}`);
    return record;
  }

  // ─── Find all (admin/doctor filtered list) ────────────────────────────────

  async findMany(
    query: MedicalRecordQueryDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<PaginatedResponseDto<MedicalRecordDetail>> {
    if (this.isAdmin(requesterRole)) {
      return this.recordRepository.findMany(query);
    }

    if (requesterRole === UserRole.ASSISTANT) {
      const doctorProfile = await this.findDoctorProfile(requesterId);
      return this.recordRepository.findMany({ ...query, doctorId: doctorProfile.id });
    }

    throw new ForbiddenException('Access denied');
  }

  // ─── Pet medical history ──────────────────────────────────────────────────

  async findPetHistory(
    petId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<MedicalRecordDetail[]> {
    await this.assertPetAccess(petId, requesterId, requesterRole);
    return this.recordRepository.findByPet(petId);
  }

  // ─── Detail ───────────────────────────────────────────────────────────────

  async findOne(
    id: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<MedicalRecordDetail> {
    const record = await this.recordOrThrow(id);
    await this.assertReadAccess(record, requesterId, requesterRole);
    return record;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateMedicalRecordDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<MedicalRecordDetail> {
    const record = await this.recordOrThrow(id);
    await this.assertWriteAccess(record, requesterId, requesterRole);

    const updated = await this.recordRepository.update(
      id,
      {
        ...(dto.chiefComplaint !== undefined && { chiefComplaint: dto.chiefComplaint }),
        ...(dto.symptoms !== undefined && { symptoms: dto.symptoms }),
        ...(dto.diagnosis !== undefined && { diagnosis: dto.diagnosis }),
        ...(dto.treatmentPlan !== undefined && { treatmentPlan: dto.treatmentPlan }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.followUpDate !== undefined && {
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        }),
        updatedBy: requesterId,
      },
      dto.prescriptions,
    );

    this.logger.log(`Medical record updated: ${id}`);
    return updated;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, requesterId: string, requesterRole: string): Promise<void> {
    const record = await this.recordOrThrow(id);
    await this.assertWriteAccess(record, requesterId, requesterRole);

    for (const att of record.attachments) {
      await this.cloudinaryService.deleteByPublicId(att.publicId).catch(() => null);
    }

    await this.recordRepository.delete(id);
    this.logger.log(`Medical record deleted: ${id}`);
  }

  // ─── Upload attachment ────────────────────────────────────────────────────

  async uploadAttachment(
    id: string,
    file: Express.Multer.File,
    requesterId: string,
    requesterRole: string,
  ): Promise<MedicalRecordDetail> {
    const record = await this.recordOrThrow(id);
    await this.assertWriteAccess(record, requesterId, requesterRole);

    const fileType = MIME_TO_ATTACHMENT_TYPE[file.mimetype];
    if (!fileType) throw new ForbiddenException('Unsupported file type. Allowed: PDF, JPG, PNG, WEBP');

    const { url, publicId } = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      'pawgo/medical/attachments',
      `att_${id}_${Date.now()}`,
    );

    const updated = await this.recordRepository.addAttachment(id, url, publicId, fileType, file.originalname);
    this.logger.log(`Attachment uploaded to record ${id}`);
    return updated;
  }

  // ─── Remove attachment ────────────────────────────────────────────────────

  async removeAttachment(
    recordId: string,
    attachmentId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<void> {
    const record = await this.recordOrThrow(recordId);
    await this.assertWriteAccess(record, requesterId, requesterRole);

    const attachment = await this.recordRepository.findAttachment(attachmentId);
    if (!attachment || attachment.recordId !== recordId) {
      throw new NotFoundException('Attachment not found');
    }

    await this.cloudinaryService.deleteByPublicId(attachment.publicId).catch(() => null);
    await this.recordRepository.removeAttachment(attachmentId);
  }

  // ─── Health summary ───────────────────────────────────────────────────────

  async getHealthSummary(
    petId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<object> {
    const pet = await this.assertPetAccess(petId, requesterId, requesterRole);
    const [lastVisit, activeTreatments] = await Promise.all([
      this.recordRepository.findLastVisit(petId),
      this.recordRepository.findActiveTreatments(petId),
    ]);
    // lastVaccination and upcomingVaccinations are merged in from VaccinationsService at controller level
    return { pet, lastVisit, activeTreatments };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private isAdmin(role: string): boolean {
    return role === UserRole.SUPER_ADMIN;
  }

  private async findDoctorProfile(userId: string): Promise<{ id: string }> {
    const profile = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Doctor profile not found');
    return profile;
  }

  private async resolveDoctorId(
    requesterId: string,
    role: string,
    clinicId: string,
  ): Promise<string> {
    if (this.isAdmin(role)) {
      // Admin acts on behalf of the clinic's doctor — for now require explicit doctorId in DTO
      // For admin, we pick the first active doctor of the clinic as a fallback
      // In practice the admin should pass doctorId as a separate field (future extension)
      // Here we just need a valid doctor: use requesterId if they have a profile, else error
      const profile = await this.prisma.doctor.findFirst({
        where: { clinicId, isActive: true },
        select: { id: true },
      });
      if (!profile) throw new NotFoundException('No active doctor found at this clinic for admin record creation. Doctors must be added first.');
      return profile.id;
    }
    const profile = await this.findDoctorProfile(requesterId);
    return profile.id;
  }

  private async assertPetAccess(
    petId: string,
    requesterId: string,
    requesterRole: string,
  ) {
    const pet = await this.petRepository.findById(petId);
    if (!pet || pet.deletedAt) throw new NotFoundException('Pet not found');

    if (this.isAdmin(requesterRole) || requesterRole === UserRole.ASSISTANT) return pet;

    // Pet owner access
    if (pet.ownerId !== requesterId) throw new ForbiddenException('Access denied');
    return pet;
  }

  private async assertReadAccess(
    record: MedicalRecordDetail,
    requesterId: string,
    requesterRole: string,
  ): Promise<void> {
    if (this.isAdmin(requesterRole) || requesterRole === UserRole.ASSISTANT) return;

    // Pet owner can read their pet's records
    const pet = await this.petRepository.findById(record.petId);
    if (pet && pet.ownerId === requesterId) return;
    throw new ForbiddenException('Access denied');
  }

  private async assertWriteAccess(
    record: MedicalRecordDetail,
    requesterId: string,
    requesterRole: string,
  ): Promise<void> {
    if (this.isAdmin(requesterRole)) return;

    if (requesterRole === UserRole.ASSISTANT) {
      const profile = await this.findDoctorProfile(requesterId);
      if (record.doctorId === profile.id) return;
      throw new ForbiddenException('You can only modify your own medical records');
    }

    throw new ForbiddenException('Only doctors and admins can modify medical records');
  }

  private async recordOrThrow(id: string): Promise<MedicalRecordDetail> {
    const record = await this.recordRepository.findById(id);
    if (!record) throw new NotFoundException('Medical record not found');
    return record;
  }
}
