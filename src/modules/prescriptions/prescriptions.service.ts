import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../common/enums';
import { PrismaService } from '../../database/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionsRepository } from './prescriptions.repository';

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    private readonly repo: PrescriptionsRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreatePrescriptionDto, requesterId: string, role: string) {
    // Auto-resolve clinicId
    let resolvedClinicId = dto.clinicId;
    if (!resolvedClinicId && role !== UserRole.SUPER_ADMIN) {
      const ids = await this.resolveClinicIds(requesterId, role);
      if (ids.length > 0) resolvedClinicId = ids[0];
    }

    const enrichedDto = { ...dto, clinicId: resolvedClinicId };
    if (resolvedClinicId) await this.assertClinicAccess(resolvedClinicId, requesterId, role);

    const prescription = await this.repo.create(enrichedDto, requesterId);
    this.logger.log(`Prescription created: ${prescription.id}`);
    return prescription;
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async findMany(query: PrescriptionQueryDto, requesterId: string, role: string) {
    if (role === UserRole.SUPER_ADMIN) {
      return this.repo.findMany(query);
    }

    const clinicIds = await this.resolveClinicIds(requesterId, role);
    return this.repo.findMany(query, clinicIds);
  }

  // ─── Detail ───────────────────────────────────────────────────────────────

  async findOne(id: string, requesterId: string, role: string) {
    const prescription = await this.repo.findById(id);
    if (!prescription) throw new NotFoundException('Prescription not found');

    if (role !== UserRole.SUPER_ADMIN) {
      const clinicIds = await this.resolveClinicIds(requesterId, role);
      if (!clinicIds.includes(prescription.clinicId ?? '')) {
        throw new ForbiddenException('Access denied');
      }
    }

    return prescription;
  }

  // ─── Pet prescriptions ─────────────────────────────────────────────────────

  async findByPet(petId: string, requesterId: string, role: string) {
    if (role === UserRole.SUPER_ADMIN) {
      return this.repo.findByPet(petId);
    }

    const clinicIds = await this.resolveClinicIds(requesterId, role);
    // Return prescriptions for this pet issued by any of the requester's clinics
    const all = await this.repo.findByPet(petId);
    return all.filter((p) => clinicIds.includes(p.clinicId ?? ''));
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePrescriptionDto, requesterId: string, role: string) {
    const prescription = await this.repo.findById(id);
    if (!prescription) throw new NotFoundException('Prescription not found');

    if (role !== UserRole.SUPER_ADMIN) {
      const clinicIds = await this.resolveClinicIds(requesterId, role);
      if (!clinicIds.includes(prescription.clinicId ?? '')) {
        throw new ForbiddenException('Access denied');
      }
    }

    const updated = await this.repo.update(id, dto, requesterId);
    this.logger.log(`Prescription updated: ${id}`);
    return updated;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async delete(id: string, requesterId: string, role: string): Promise<void> {
    const prescription = await this.repo.findById(id);
    if (!prescription) throw new NotFoundException('Prescription not found');

    if (role !== UserRole.SUPER_ADMIN) {
      const clinicIds = await this.resolveClinicIds(requesterId, role);
      if (!clinicIds.includes(prescription.clinicId ?? '')) {
        throw new ForbiddenException('Access denied');
      }
    }

    await this.repo.delete(id);
    this.logger.log(`Prescription deleted: ${id}`);
  }

  // ─── PDF Export ───────────────────────────────────────────────────────────

  async generatePdf(id: string, requesterId: string, role: string): Promise<Buffer> {
    const rx = await this.findOne(id, requesterId, role);

    // Lazy import to avoid startup cost
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const clinic = rx.clinic as any;
      const pet = rx.pet as any;
      const doctor = rx.doctor as any;

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text(clinic?.name ?? 'Clinic', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(clinic?.address ?? '', { align: 'center' });
      doc.text(`Phone: ${clinic?.phone ?? ''}`, { align: 'center' });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // Title
      doc.fontSize(16).font('Helvetica-Bold').text('PRESCRIPTION', { align: 'center' });
      doc.moveDown(0.5);

      // Rx details
      doc.fontSize(10).font('Helvetica');
      const dateStr = new Date((rx as any).prescribedAt).toLocaleDateString('en-IN');
      doc.text(`Date: ${dateStr}`, 50);
      if (doctor) {
        const dName = `Dr. ${doctor.user?.firstName ?? ''} ${doctor.user?.lastName ?? ''}`.trim();
        doc.text(`Doctor: ${dName}`, 50);
      }
      doc.moveDown(0.5);

      // Patient info
      doc.font('Helvetica-Bold').text('Patient Information', 50);
      doc.font('Helvetica');
      doc.text(`Pet Name: ${pet?.name ?? ''}   Species: ${pet?.species ?? ''}   Breed: ${pet?.breed ?? ''}`, 50);
      doc.moveDown(0.5);

      // Medicine
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(12).text('Rx', 50);
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(11).text((rx as any).medicineName, 60);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Dosage: ${(rx as any).dosage}`, 70);
      doc.text(`Frequency: ${(rx as any).frequency}`, 70);
      doc.text(`Duration: ${(rx as any).duration}`, 70);
      if ((rx as any).instructions) doc.text(`Instructions: ${(rx as any).instructions}`, 70);
      doc.moveDown(0.5);

      if ((rx as any).notes) {
        doc.font('Helvetica-Bold').text('Notes:', 50);
        doc.font('Helvetica').text((rx as any).notes, 60);
        doc.moveDown(0.5);
      }

      if ((rx as any).expiresAt) {
        const expStr = new Date((rx as any).expiresAt).toLocaleDateString('en-IN');
        doc.text(`Valid Until: ${expStr}`, 50);
      }

      // Footer
      const pageHeight = doc.page.height;
      doc.fontSize(9).font('Helvetica').text(
        `Generated on ${new Date().toLocaleString('en-IN')}`,
        50,
        pageHeight - 80,
        { align: 'center', width: 495 },
      );

      doc.end();
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async resolveClinicIds(userId: string, role: string): Promise<string[]> {
    const ids: string[] = [];

    const owned = await this.prisma.clinic.findFirst({
      where: { createdBy: userId, deletedAt: null },
      select: { id: true },
    });
    if (owned) ids.push(owned.id);

    const staff = await this.prisma.clinicStaff.findUnique({
      where: { userId },
      select: { clinicId: true },
    });
    if (staff) ids.push(staff.clinicId);

    return ids;
  }

  private async assertClinicAccess(clinicId: string | undefined, requesterId: string, role: string): Promise<void> {
    if (!clinicId || role === UserRole.SUPER_ADMIN) return;
    const ids = await this.resolveClinicIds(requesterId, role);
    if (!ids.includes(clinicId)) {
      throw new ForbiddenException('You do not have access to this clinic');
    }
  }
}
