import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Clinic, Doctor } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { toSlug } from '../../common/utils/string.helper';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { ClinicRepository, ClinicDetail } from './clinic.repository';
import { ClinicQueryDto } from './dto/clinic-query.dto';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { NearbyClinicDto } from './dto/nearby-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);

  constructor(
    private readonly clinicRepository: ClinicRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateClinicDto, createdBy: string, role: string): Promise<Clinic> {
    // CLINIC_OWNER can only have one clinic
    if (role === UserRole.CLINIC_OWNER) {
      const already = await this.clinicRepository.existsByCreatedBy(createdBy);
      if (already) throw new ConflictException('You already have a clinic registered');
    }
    const slug = await this.generateUniqueSlug(dto.name);
    const clinic = await this.clinicRepository.create(dto, slug, createdBy);
    this.logger.log(`Clinic created: ${clinic.id} (${clinic.slug})`);
    return clinic;
  }

  // ─── My clinic (clinic owner) ─────────────────────────────────────────────

  async findMyClinic(ownerId: string): Promise<ClinicDetail> {
    const clinic = await this.clinicRepository.findByCreatedBy(ownerId);
    if (!clinic) throw new NotFoundException('You do not have a registered clinic');
    return clinic;
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async findMany(query: ClinicQueryDto, role?: string): Promise<PaginatedResponseDto<Clinic>> {
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    // Non-admins always see only verified + active clinics; admin sees all by default
    const effectiveQuery: ClinicQueryDto = isSuperAdmin
      ? query
      : { ...query, verified: true, isActive: true };
    return this.clinicRepository.findMany(effectiveQuery);
  }

  // ─── Nearby ───────────────────────────────────────────────────────────────

  async findNearby(dto: NearbyClinicDto) {
    return this.clinicRepository.findNearby(dto);
  }

  // ─── Detail ───────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<ClinicDetail> {
    const clinic = await this.clinicRepository.findById(id);
    if (!clinic || clinic.deletedAt) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateClinicDto, requesterId: string, role: string): Promise<Clinic> {
    const clinic = await this.findActiveOrThrow(id);
    this.assertAdminOrOwner(clinic, requesterId, role);

    const updated = await this.clinicRepository.update(id, dto, requesterId);
    this.logger.log(`Clinic updated: ${id}`);
    return updated;
  }

  // ─── Verify ───────────────────────────────────────────────────────────────

  async verify(id: string, requesterId: string, role: string): Promise<Clinic> {
    await this.findActiveOrThrow(id);
    this.assertAdmin(role);
    const clinic = await this.clinicRepository.verify(id, requesterId);
    this.logger.log(`Clinic verified: ${id}`);
    return clinic;
  }

  // ─── Suspend / Activate (admin toggles isActive without deleting) ─────────

  async suspend(id: string, requesterId: string, role: string): Promise<Clinic> {
    await this.findActiveOrThrow(id);
    this.assertAdmin(role);
    const clinic = await this.clinicRepository.setActive(id, false, requesterId);
    this.logger.log(`Clinic suspended: ${id}`);
    return clinic;
  }

  async activate(id: string, requesterId: string, role: string): Promise<Clinic> {
    const clinic = await this.clinicRepository.findById(id);
    if (!clinic || clinic.deletedAt) throw new NotFoundException('Clinic not found');
    this.assertAdmin(role);
    const updated = await this.clinicRepository.setActive(id, true, requesterId);
    this.logger.log(`Clinic activated: ${id}`);
    return updated;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, requesterId: string, role: string): Promise<void> {
    const clinic = await this.findActiveOrThrow(id);
    this.assertAdmin(role);

    if (clinic.logoPublicId) await this.cloudinaryService.deleteByPublicId(clinic.logoPublicId);
    if (clinic.bannerPublicId) await this.cloudinaryService.deleteByPublicId(clinic.bannerPublicId);

    await this.clinicRepository.softDelete(id, requesterId);
    this.logger.log(`Clinic soft-deleted: ${id}`);
  }

  // ─── Upload Logo ──────────────────────────────────────────────────────────

  async uploadLogo(id: string, file: Express.Multer.File, requesterId: string, role: string): Promise<Clinic> {
    const clinic = await this.findActiveOrThrow(id);
    this.assertAdminOrOwner(clinic, requesterId, role);

    if (clinic.logoPublicId) await this.cloudinaryService.deleteByPublicId(clinic.logoPublicId);
    const { url, publicId } = await this.cloudinaryService.uploadBuffer(file.buffer, 'pawgo/clinics/logos', `logo_${id}`);
    return this.clinicRepository.updateLogo(id, url, publicId, requesterId);
  }

  // ─── Upload Banner ────────────────────────────────────────────────────────

  async uploadBanner(id: string, file: Express.Multer.File, requesterId: string, role: string): Promise<Clinic> {
    const clinic = await this.findActiveOrThrow(id);
    this.assertAdminOrOwner(clinic, requesterId, role);

    if (clinic.bannerPublicId) await this.cloudinaryService.deleteByPublicId(clinic.bannerPublicId);
    const { url, publicId } = await this.cloudinaryService.uploadBuffer(file.buffer, 'pawgo/clinics/banners', `banner_${id}`);
    return this.clinicRepository.updateBanner(id, url, publicId, requesterId);
  }

  // ─── Public: doctors at a clinic ─────────────────────────────────────────

  async findClinicDoctors(clinicId: string): Promise<object[]> {
    const clinic = await this.clinicRepository.findById(clinicId);
    if (!clinic || clinic.deletedAt) throw new NotFoundException('Clinic not found');
    return this.clinicRepository.findDoctors(clinicId) as unknown as object[];
  }

  // ─── Rating aggregation (called by ReviewsService) ────────────────────────

  async recalculateRating(clinicId: string, rating: number, totalReviews: number): Promise<void> {
    await this.clinicRepository.updateRating(clinicId, rating, totalReviews);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async findActiveOrThrow(id: string): Promise<ClinicDetail> {
    const clinic = await this.clinicRepository.findById(id);
    if (!clinic || clinic.deletedAt) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  private assertAdmin(role: string): void {
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can perform this action');
    }
  }

  private assertAdminOrOwner(clinic: ClinicDetail, requesterId: string, role: string): void {
    if (role === UserRole.SUPER_ADMIN) return;
    if (role === UserRole.CLINIC_OWNER && clinic.createdBy === requesterId) return;
    throw new ForbiddenException('You do not have permission to manage this clinic');
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    let slug = toSlug(name);
    let exists = await this.clinicRepository.existsBySlug(slug);
    let i = 1;
    while (exists) {
      slug = `${toSlug(name)}-${i++}`;
      exists = await this.clinicRepository.existsBySlug(slug);
    }
    return slug;
  }
}
