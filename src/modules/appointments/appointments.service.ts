import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Appointment } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import {
  APPOINTMENT_TRANSITIONS,
  AppointmentStatus,
  TERMINAL_STATUSES,
} from '../../common/enums/appointment.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { PrismaService } from '../../database/prisma.service';
import { ClinicRepository } from '../clinics/clinic.repository';
import { DoctorRepository } from '../doctors/doctor.repository';
import { PetRepository } from '../pets/pet.repository';
import {
  AppointmentEvent,
  AppointmentEventPayload,
} from '../../common/events/appointment.events';
import { AppointmentRepository, AppointmentDetail } from './appointment.repository';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { WalkInAppointmentDto } from './dto/walk-in-appointment.dto';

// Map JS Date.getDay() (0=Sunday) to DayOfWeek enum strings
const JS_DAY_TO_ENUM = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly petRepository: PetRepository,
    private readonly clinicRepository: ClinicRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Book appointment ──────────────────────────────────────────────────────

  async create(
    dto: CreateAppointmentDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<AppointmentDetail> {
    const isAdmin = this.isAdmin(requesterRole);

    // 1. Validate pet ownership
    const pet = await this.petRepository.findById(dto.petId);
    if (!pet || pet.deletedAt) throw new NotFoundException('Pet not found');
    if (!isAdmin && pet.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this pet');
    }

    // 2. Validate clinic
    const clinic = await this.clinicRepository.findById(dto.clinicId);
    if (!clinic || clinic.deletedAt || !clinic.isActive) {
      throw new NotFoundException('Clinic not found or inactive');
    }

    // 3. Validate doctor
    const doctor = await this.doctorRepository.findById(dto.doctorId);
    if (!doctor || !doctor.isActive) throw new NotFoundException('Doctor not found or inactive');

    // 4. Doctor must belong to the clinic
    if (doctor.clinicId && doctor.clinicId !== dto.clinicId) {
      throw new BadRequestException('Doctor does not work at this clinic');
    }

    // 5. Parse date and validate availability
    const appointmentDate = this.parseDate(dto.appointmentDate);
    const dayEnum = JS_DAY_TO_ENUM[appointmentDate.getDay()];

    const availability = doctor.availability?.find(
      (a) => a.day === dayEnum && a.isAvailable,
    );
    if (!availability) {
      throw new BadRequestException(`Doctor is not available on ${dayEnum}`);
    }

    const slotDuration = 30;
    const endTime = this.addMinutes(dto.startTime, slotDuration);

    if (!this.timeInRange(dto.startTime, availability.startTime, availability.endTime)) {
      throw new BadRequestException(
        `Requested slot ${dto.startTime} is outside doctor availability (${availability.startTime}–${availability.endTime})`,
      );
    }

    // 6. Double-booking check
    const conflict = await this.appointmentRepository.existsConflict(
      dto.doctorId,
      appointmentDate,
      dto.startTime,
    );
    if (conflict) {
      throw new BadRequestException('This time slot is already booked');
    }

    // 7. Generate appointment number + create
    const appointmentNumber = await this.appointmentRepository.generateAppointmentNumber();
    const ownerId = isAdmin ? pet.ownerId : requesterId;

    const appointment = await this.appointmentRepository.create({
      appointmentNumber,
      pet: { connect: { id: dto.petId } },
      owner: { connect: { id: ownerId } },
      clinic: { connect: { id: dto.clinicId } },
      doctor: { connect: { id: dto.doctorId } },
      appointmentDate,
      startTime: dto.startTime,
      endTime,
      reason: dto.reason,
      notes: dto.notes,
      slotDurationMinutes: slotDuration,
      createdBy: requesterId,
    });

    this.logger.log(`Appointment created: ${appointment.appointmentNumber}`);
    this.emitEvent(AppointmentEvent.CREATED, appointment);
    return appointment;
  }

  // ─── Walk-in appointment (reception creates for any visitor) ─────────────

  async createWalkIn(dto: WalkInAppointmentDto, requesterId: string, requesterRole: string): Promise<AppointmentDetail> {
    // Resolve clinic for the requester
    let clinicId: string;
    if (requesterRole === UserRole.SUPER_ADMIN) {
      const doctor = await this.doctorRepository.findById(dto.doctorId);
      if (!doctor) throw new NotFoundException('Doctor not found');
      if (!doctor.clinicId) throw new BadRequestException('Doctor is not assigned to a clinic');
      clinicId = doctor.clinicId;
    } else {
      const clinic = await this.clinicRepository.findByCreatedBy(requesterId);
      if (!clinic) {
        // Might be staff — look up clinic through ClinicStaff
        const staffRecord = await this.prisma.clinicStaff.findUnique({
          where: { userId: requesterId },
          select: { clinicId: true },
        });
        if (!staffRecord) throw new NotFoundException('You are not associated with a clinic');
        clinicId = staffRecord.clinicId;
      } else {
        clinicId = clinic.id;
      }
    }

    // Validate doctor belongs to clinic
    const doctor = await this.doctorRepository.findById(dto.doctorId);
    if (!doctor || !doctor.isActive) throw new NotFoundException('Doctor not found or inactive');
    if (doctor.clinicId !== clinicId) throw new BadRequestException('Doctor does not belong to your clinic');

    const appointmentDate = this.parseDate(dto.appointmentDate);
    const slotDuration = 30;
    const endTime = dto.endTime ?? this.addMinutes(dto.startTime, slotDuration);

    // Double-booking check
    const conflict = await this.appointmentRepository.existsConflict(dto.doctorId, appointmentDate, dto.startTime);
    if (conflict) throw new BadRequestException('This time slot is already booked');

    // Validate: either registered (petId+ownerId) or anonymous (walkinOwnerName required)
    if (!dto.petId && !dto.walkinOwnerName) {
      throw new BadRequestException(
        'Provide petId + ownerId for a registered patient, or walkinOwnerName for an unregistered walk-in',
      );
    }

    const appointmentNumber = await this.appointmentRepository.generateAppointmentNumber();

    const appointment = await this.appointmentRepository.create({
      appointmentNumber,
      ...(dto.petId ? { pet: { connect: { id: dto.petId } } } : {}),
      ...(dto.ownerId ? { owner: { connect: { id: dto.ownerId } } } : {}),
      clinic: { connect: { id: clinicId } },
      doctor: { connect: { id: dto.doctorId } },
      appointmentDate,
      startTime: dto.startTime,
      endTime,
      reason: dto.reason,
      notes: dto.notes,
      slotDurationMinutes: slotDuration,
      status: 'CONFIRMED',
      isWalkIn: true,
      walkinOwnerName: dto.walkinOwnerName,
      walkinPhone: dto.walkinPhone,
      createdBy: requesterId,
    });

    this.logger.log(`Walk-in appointment created: ${appointment.appointmentNumber}`);
    return appointment;
  }

  // ─── Available slots ───────────────────────────────────────────────────────

  async getAvailableSlots(doctorId: string, query: AvailableSlotsQueryDto): Promise<string[]> {
    const doctor = await this.doctorRepository.findById(doctorId);
    if (!doctor || !doctor.isActive) throw new NotFoundException('Doctor not found');

    const appointmentDate = this.parseDate(query.date);
    const dayEnum = JS_DAY_TO_ENUM[appointmentDate.getDay()];

    const availability = doctor.availability?.find((a) => a.day === dayEnum && a.isAvailable);
    if (!availability) return [];

    const slotDuration = query.slotDuration ?? 30;
    const allSlots = this.generateSlots(availability.startTime, availability.endTime, slotDuration);

    const booked = await this.appointmentRepository.getBookedTimes(doctorId, appointmentDate);
    const bookedSet = new Set(booked);

    return allSlots.filter((slot) => !bookedSet.has(slot));
  }

  // ─── My appointments ───────────────────────────────────────────────────────

  async findMyAppointments(
    ownerId: string,
    query: AppointmentQueryDto,
  ): Promise<PaginatedResponseDto<AppointmentDetail>> {
    return this.appointmentRepository.findMany(
      this.buildWhere({ ...query, ownerId }),
      query,
    );
  }

  // ─── Appointment history (completed / cancelled / no_show) ─────────────────

  async findHistory(
    ownerId: string,
    query: AppointmentQueryDto,
  ): Promise<PaginatedResponseDto<AppointmentDetail>> {
    return this.appointmentRepository.findMany(
      {
        ownerId,
        status: { in: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      },
      query,
    );
  }

  // ─── Detail ────────────────────────────────────────────────────────────────

  async findOne(id: string, requesterId: string, requesterRole: string): Promise<AppointmentDetail> {
    const appt = await this.appointmentRepository.findById(id);
    if (!appt) throw new NotFoundException('Appointment not found');

    if (this.isAdmin(requesterRole)) return appt;

    // Pet owners can view their own appointments
    if (appt.ownerId === requesterId) return appt;

    // Doctors can view their assigned appointments
    if (requesterRole === UserRole.ASSISTANT) {
      const doctorProfile = await this.prisma.doctor.findUnique({
        where: { userId: requesterId },
        select: { id: true },
      });
      if (doctorProfile && appt.doctorId === doctorProfile.id) return appt;
    }

    // Clinic staff can view appointments at their clinic
    if (
      requesterRole === UserRole.CLINIC_OWNER ||
      requesterRole === UserRole.CLINIC_MANAGER ||
      requesterRole === UserRole.RECEPTIONIST
    ) {
      const clinicId = await this.resolveStaffClinicId(requesterId);
      if (clinicId && appt.clinicId === clinicId) return appt;
    }

    throw new ForbiddenException('Access denied');
  }

  // ─── Admin / clinic list ───────────────────────────────────────────────────

  async findAll(query: AppointmentQueryDto): Promise<PaginatedResponseDto<AppointmentDetail>> {
    return this.appointmentRepository.findMany(this.buildWhere(query), query);
  }

  async findByClinic(
    clinicId: string,
    query: AppointmentQueryDto,
  ): Promise<PaginatedResponseDto<AppointmentDetail>> {
    return this.appointmentRepository.findMany(
      this.buildWhere({ ...query, clinicId }),
      query,
    );
  }

  async findMyClinicAppointments(
    requesterId: string,
    requesterRole: string,
    query: AppointmentQueryDto,
  ): Promise<PaginatedResponseDto<AppointmentDetail>> {
    if (this.isAdmin(requesterRole)) {
      return this.appointmentRepository.findMany(this.buildWhere(query), query);
    }
    const clinicId = await this.resolveStaffClinicId(requesterId);
    if (!clinicId) throw new NotFoundException('You are not associated with a clinic');
    return this.appointmentRepository.findMany(this.buildWhere({ ...query, clinicId }), query);
  }

  async findByDoctor(
    doctorId: string,
    query: AppointmentQueryDto,
  ): Promise<PaginatedResponseDto<AppointmentDetail>> {
    return this.appointmentRepository.findMany(
      this.buildWhere({ ...query, doctorId }),
      query,
    );
  }

  async findByDoctorUserId(
    userId: string,
    query: AppointmentQueryDto,
  ): Promise<PaginatedResponseDto<AppointmentDetail>> {
    const doctorProfile = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!doctorProfile) throw new NotFoundException('Doctor profile not found');
    return this.findByDoctor(doctorProfile.id, query);
  }

  // ─── Status transition ────────────────────────────────────────────────────

  async updateStatus(
    id: string,
    dto: UpdateAppointmentStatusDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<AppointmentDetail> {
    const appt = await this.appointmentRepository.findRaw(id);
    if (!appt) throw new NotFoundException('Appointment not found');

    await this.assertStatusPermission(appt, dto.status, requesterId, requesterRole);

    const allowed = APPOINTMENT_TRANSITIONS[appt.status as AppointmentStatus];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${appt.status} to ${dto.status}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const updated = await this.appointmentRepository.update(id, {
      status: dto.status,
      updatedBy: requesterId,
    });
    this.logger.log(`Appointment ${id} status: ${appt.status} → ${dto.status}`);
    this.emitEvent(this.statusToEvent(dto.status), updated);
    return updated;
  }

  // ─── Reschedule ────────────────────────────────────────────────────────────

  async reschedule(
    id: string,
    dto: RescheduleAppointmentDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<AppointmentDetail> {
    const appt = await this.appointmentRepository.findRaw(id);
    if (!appt) throw new NotFoundException('Appointment not found');

    this.assertOwnerOrAdmin(appt.ownerId, requesterId, requesterRole, 'reschedule');

    if (TERMINAL_STATUSES.includes(appt.status as AppointmentStatus)) {
      throw new BadRequestException(`Cannot reschedule an appointment with status ${appt.status}`);
    }

    // Validate new slot
    const doctor = await this.doctorRepository.findById(appt.doctorId);
    if (!doctor || !doctor.isActive) throw new NotFoundException('Doctor not found');

    const newDate = this.parseDate(dto.appointmentDate);
    const dayEnum = JS_DAY_TO_ENUM[newDate.getDay()];
    const availability = doctor.availability?.find((a) => a.day === dayEnum && a.isAvailable);
    if (!availability) {
      throw new BadRequestException(`Doctor is not available on ${dayEnum}`);
    }
    if (!this.timeInRange(dto.startTime, availability.startTime, availability.endTime)) {
      throw new BadRequestException(
        `Slot ${dto.startTime} is outside doctor availability (${availability.startTime}–${availability.endTime})`,
      );
    }

    const conflict = await this.appointmentRepository.existsConflict(
      appt.doctorId,
      newDate,
      dto.startTime,
      id,
    );
    if (conflict) throw new BadRequestException('This time slot is already booked');

    const endTime = this.addMinutes(dto.startTime, appt.slotDurationMinutes);
    const updated = await this.appointmentRepository.update(id, {
      appointmentDate: newDate,
      startTime: dto.startTime,
      endTime,
      status: AppointmentStatus.PENDING,
      rescheduledFrom: { connect: { id } },
      updatedBy: requesterId,
    });
    this.logger.log(`Appointment ${id} rescheduled to ${dto.appointmentDate} ${dto.startTime}`);
    this.emitEvent(AppointmentEvent.RESCHEDULED, updated);
    return updated;
  }

  // ─── Cancel ────────────────────────────────────────────────────────────────

  async cancel(
    id: string,
    dto: CancelAppointmentDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<AppointmentDetail> {
    const appt = await this.appointmentRepository.findRaw(id);
    if (!appt) throw new NotFoundException('Appointment not found');

    this.assertOwnerOrAdmin(appt.ownerId, requesterId, requesterRole, 'cancel');

    if (TERMINAL_STATUSES.includes(appt.status as AppointmentStatus)) {
      throw new BadRequestException(`Cannot cancel an appointment with status ${appt.status}`);
    }

    const updated = await this.appointmentRepository.update(id, {
      status: AppointmentStatus.CANCELLED,
      cancellationReason: dto.reason,
      updatedBy: requesterId,
    });
    this.logger.log(`Appointment ${id} cancelled`);
    this.emitEvent(AppointmentEvent.CANCELLED, updated);
    return updated;
  }

  // ─── Assign doctor / assistant ────────────────────────────────────────────

  async assignDoctor(
    id: string,
    doctorId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<AppointmentDetail> {
    const appt = await this.appointmentRepository.findRaw(id);
    if (!appt) throw new NotFoundException('Appointment not found');

    const isAdmin = this.isAdmin(requesterRole);
    if (!isAdmin) {
      const clinicId = await this.resolveStaffClinicId(requesterId);
      if (!clinicId || appt.clinicId !== clinicId)
        throw new ForbiddenException('You do not have permission to assign a doctor to this appointment');
    }

    const doctor = await this.doctorRepository.findById(doctorId);
    if (!doctor || !doctor.isActive) throw new NotFoundException('Doctor not found or inactive');

    const updated = await this.appointmentRepository.update(id, {
      doctor: { connect: { id: doctorId } },
      updatedBy: requesterId,
    });
    this.logger.log(`Appointment ${id} assigned to doctor ${doctorId}`);
    return updated;
  }

  async assignAssistant(
    id: string,
    assistantId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<AppointmentDetail> {
    const appt = await this.appointmentRepository.findRaw(id);
    if (!appt) throw new NotFoundException('Appointment not found');

    const isAdmin = this.isAdmin(requesterRole);
    if (!isAdmin) {
      const clinicId = await this.resolveStaffClinicId(requesterId);
      if (!clinicId || appt.clinicId !== clinicId)
        throw new ForbiddenException('You do not have permission to assign an assistant to this appointment');
    }

    const updated = await this.appointmentRepository.update(id, {
      assistant: assistantId ? { connect: { id: assistantId } } : { disconnect: true },
      updatedBy: requesterId,
    });
    this.logger.log(`Appointment ${id} assigned to assistant ${assistantId}`);
    return updated;
  }

  async updateNotes(id: string, notes: string, requesterId: string, requesterRole: string): Promise<AppointmentDetail> {
    const appt = await this.appointmentRepository.findRaw(id);
    if (!appt) throw new NotFoundException('Appointment not found');

    if (!this.isAdmin(requesterRole)) {
      const clinicId = await this.resolveStaffClinicId(requesterId);
      if (!clinicId || appt.clinicId !== clinicId)
        throw new ForbiddenException('You do not have permission to update this appointment');
    }

    const updated = await this.appointmentRepository.update(id, { notes, updatedBy: requesterId });
    this.logger.log(`Appointment ${id} notes updated`);
    return updated;
  }

  // ─── Statistics ────────────────────────────────────────────────────────────

  async getAdminStats() {
    return this.appointmentRepository.getStats({});
  }

  async getDoctorStats(requesterId: string) {
    const doctorProfile = await this.prisma.doctor.findUnique({
      where: { userId: requesterId },
      select: { id: true },
    });
    if (!doctorProfile) throw new NotFoundException('Doctor profile not found');
    return this.appointmentRepository.getStats({ doctorId: doctorProfile.id });
  }

  async getClinicStats(clinicId: string) {
    return this.appointmentRepository.getStats({ clinicId });
  }

  // ─── Slot generation engine ────────────────────────────────────────────────

  generateSlots(startTime: string, endTime: string, slotDurationMinutes: number): string[] {
    const slots: string[] = [];
    let current = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    while (current + slotDurationMinutes <= end) {
      slots.push(this.minutesToTime(current));
      current += slotDurationMinutes;
    }
    return slots;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private parseDate(dateStr: string): Date {
    // Parse YYYY-MM-DD as UTC midnight to avoid timezone shifts
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private addMinutes(time: string, minutes: number): string {
    return this.minutesToTime(this.timeToMinutes(time) + minutes);
  }

  private timeInRange(time: string, rangeStart: string, rangeEnd: string): boolean {
    const t = this.timeToMinutes(time);
    const s = this.timeToMinutes(rangeStart);
    const e = this.timeToMinutes(rangeEnd);
    return t >= s && t < e;
  }

  private isAdmin(role: string): boolean {
    return role === UserRole.SUPER_ADMIN;
  }

  private assertOwnerOrAdmin(
    ownerId: string | null,
    requesterId: string,
    role: string,
    action: string,
  ): void {
    if (this.isAdmin(role)) return;
    if (ownerId === requesterId) return;
    if (
      role === UserRole.CLINIC_OWNER ||
      role === UserRole.CLINIC_MANAGER ||
      role === UserRole.RECEPTIONIST
    ) return;
    throw new ForbiddenException(`You do not have permission to ${action} this appointment`);
  }

  private async assertStatusPermission(
    appt: Appointment,
    newStatus: AppointmentStatus,
    requesterId: string,
    requesterRole: string,
  ): Promise<void> {
    const isAdmin = this.isAdmin(requesterRole);
    if (isAdmin) return;

    // Doctors can update status for their own appointments
    if (requesterRole === UserRole.ASSISTANT) {
      const doctorProfile = await this.prisma.doctor.findUnique({
        where: { userId: requesterId },
        select: { id: true },
      });
      if (doctorProfile && appt.doctorId === doctorProfile.id) return;
    }

    // Clinic staff (manager/receptionist) can update status for appointments at their clinic
    if (requesterRole === UserRole.CLINIC_MANAGER || requesterRole === UserRole.RECEPTIONIST || requesterRole === UserRole.CLINIC_OWNER) {
      const clinicId = await this.resolveStaffClinicId(requesterId);
      if (clinicId && appt.clinicId === clinicId) return;
    }

    // Pet owners can cancel their own appointment
    if (appt.ownerId === requesterId && newStatus === AppointmentStatus.CANCELLED) return;

    throw new ForbiddenException('You do not have permission to update this appointment status');
  }

  private async resolveStaffClinicId(userId: string): Promise<string | null> {
    const owned = await this.clinicRepository.findByCreatedBy(userId);
    if (owned) return owned.id;
    const staff = await this.prisma.clinicStaff.findUnique({
      where: { userId },
      select: { clinicId: true },
    });
    return staff?.clinicId ?? null;
  }

  private emitEvent(event: AppointmentEvent, appt: AppointmentDetail): void {
    const payload: AppointmentEventPayload = {
      appointmentId: appt.id,
      appointmentNumber: appt.appointmentNumber,
      ownerId: appt.ownerId ?? '',
      doctorId: appt.doctorId,
      clinicId: appt.clinicId,
      petId: appt.petId ?? '',
      status: appt.status,
      appointmentDate: appt.appointmentDate,
      startTime: appt.startTime,
    };
    this.eventEmitter.emit(event, payload);
  }

  private statusToEvent(status: AppointmentStatus): AppointmentEvent {
    switch (status) {
      case AppointmentStatus.CONFIRMED: return AppointmentEvent.CONFIRMED;
      case AppointmentStatus.CANCELLED: return AppointmentEvent.CANCELLED;
      case AppointmentStatus.COMPLETED: return AppointmentEvent.COMPLETED;
      case AppointmentStatus.NO_SHOW: return AppointmentEvent.NO_SHOW;
      default: return AppointmentEvent.STATUS_CHANGED;
    }
  }

  private buildWhere(query: Partial<AppointmentQueryDto> & { ownerId?: string; clinicId?: string; doctorId?: string }) {
    const where: Record<string, unknown> = {};

    if (query.ownerId) where['ownerId'] = query.ownerId;
    if (query.clinicId) where['clinicId'] = query.clinicId;
    if (query.doctorId) where['doctorId'] = query.doctorId;
    if (query.petId) where['petId'] = query.petId;
    if (query.status) where['status'] = query.status;
    if (query.appointmentNumber) where['appointmentNumber'] = query.appointmentNumber;

    if (query.date) {
      const [y, m, d] = query.date.split('-').map(Number);
      const dayStart = new Date(Date.UTC(y, m - 1, d));
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      where['appointmentDate'] = { gte: dayStart, lt: dayEnd };
    } else if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) { const [y, m, d] = query.from.split('-').map(Number); range['gte'] = new Date(Date.UTC(y, m - 1, d)); }
      if (query.to)   { const [y, m, d] = query.to.split('-').map(Number);   range['lte'] = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)); }
      where['appointmentDate'] = range;
    } else if (query.upcoming) {
      where['appointmentDate'] = { gte: new Date() };
      where['status'] = { notIn: TERMINAL_STATUSES };
    }

    return where;
  }
}
