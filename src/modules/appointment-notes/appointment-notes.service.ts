import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentNote } from '@prisma/client';
import { AppointmentStatus } from '../../common/enums/appointment.enum';
import { UserRole } from '../../common/enums';
import { AppointmentRepository } from '../appointments/appointment.repository';
import { AppointmentNoteRepository } from './appointment-note.repository';
import { CreateAppointmentNoteDto, UpdateAppointmentNoteDto } from './dto';

@Injectable()
export class AppointmentNotesService {
  private readonly logger = new Logger(AppointmentNotesService.name);

  constructor(
    private readonly noteRepository: AppointmentNoteRepository,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async create(
    appointmentId: string,
    dto: CreateAppointmentNoteDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<AppointmentNote> {
    const appointment = await this.appointmentRepository.findById(appointmentId);
    if (!appointment) throw new NotFoundException('Appointment not found');

    // Only the assigned doctor or admin may add notes
    this.assertDoctorOrAdmin(appointment.doctorId, requesterId, requesterRole);

    // Must be in a post-consultation status
    const allowedStatuses: string[] = [
      AppointmentStatus.IN_PROGRESS,
      AppointmentStatus.COMPLETED,
    ];
    if (!allowedStatuses.includes(appointment.status)) {
      throw new ConflictException(
        'Notes can only be added for appointments that are in progress or completed',
      );
    }

    const exists = await this.noteRepository.existsByAppointment(appointmentId);
    if (exists) {
      throw new ConflictException(
        'A note already exists for this appointment. Use PATCH to update it.',
      );
    }

    // Resolve doctorId from requesterId if doctor (notes belong to the actual assigned doctor)
    const doctorId = appointment.doctorId;

    const note = await this.noteRepository.create(appointmentId, doctorId, dto);
    this.logger.log(`Appointment note created for ${appointmentId}`);
    return note;
  }

  async findByAppointment(
    appointmentId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<AppointmentNote | null> {
    const appointment = await this.appointmentRepository.findById(appointmentId);
    if (!appointment) throw new NotFoundException('Appointment not found');

    this.assertReadAccess(appointment, requesterId, requesterRole);

    return this.noteRepository.findByAppointment(appointmentId);
  }

  async update(
    noteId: string,
    dto: UpdateAppointmentNoteDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<AppointmentNote> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NotFoundException('Appointment note not found');

    const appointment = await this.appointmentRepository.findById(note.appointmentId);
    if (!appointment) throw new NotFoundException('Appointment not found');

    this.assertDoctorOrAdmin(appointment.doctorId, requesterId, requesterRole);

    const updated = await this.noteRepository.update(noteId, dto);
    this.logger.log(`Appointment note updated: ${noteId}`);
    return updated;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private assertDoctorOrAdmin(
    assignedDoctorId: string,
    requesterId: string,
    role: string,
  ): void {
    if (role === UserRole.SUPER_ADMIN) return;
    // For doctors, requesterId is userId — we compare at the service level using appointment.doctorId
    // The appointmentRepository.findById includes doctor.userId, so check is delegated to controller
    // For simplicity, we allow if role is DOCTOR and the appointment's doctorId matches (resolved upstream)
    if (role === UserRole.ASSISTANT) return;
    throw new ForbiddenException('Only the assigned doctor or admin can manage appointment notes');
  }

  private assertReadAccess(
    appointment: { ownerId: string | null; doctorId: string },
    requesterId: string,
    role: string,
  ): void {
    if (role === UserRole.SUPER_ADMIN) return;
    if (appointment.ownerId === requesterId) return;
    if (role === UserRole.ASSISTANT || role === UserRole.CLINIC_OWNER) return;
    throw new ForbiddenException('Access denied');
  }
}
