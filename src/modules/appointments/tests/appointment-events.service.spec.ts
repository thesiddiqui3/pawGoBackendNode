import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentEvent } from '../../../common/events/appointment.events';
import { UserRole } from '../../../common/enums';
import { AppointmentStatus } from '../../../common/enums/appointment.enum';
import { ClinicRepository } from '../../clinics/clinic.repository';
import { DoctorRepository } from '../../doctors/doctor.repository';
import { PetRepository } from '../../pets/pet.repository';
import { PrismaService } from '../../../database/prisma.service';
import { AppointmentRepository } from '../appointment.repository';
import { AppointmentsService } from '../appointments.service';

const makeAppt = (overrides: Record<string, unknown> = {}) => ({
  id: 'appt-uuid',
  appointmentNumber: 'PGA-2026-000001',
  ownerId: 'owner-id',
  doctorId: 'doc-uuid',
  clinicId: 'clinic-uuid',
  petId: 'pet-uuid',
  status: AppointmentStatus.PENDING,
  appointmentDate: new Date('2026-06-20'),
  startTime: '10:00',
  slotDurationMinutes: 30,
  ...overrides,
});

const mockAppointmentRepo = () => ({
  findById: jest.fn(),
  findRaw: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  generateAppointmentNumber: jest.fn(),
  existsConflict: jest.fn(),
  getBookedTimes: jest.fn(),
  getStats: jest.fn(),
});

const mockPetRepo = () => ({ findById: jest.fn() });
const mockClinicRepo = () => ({ findById: jest.fn() });
const mockDoctorRepo = () => ({ findById: jest.fn() });
const mockPrismaService = () => ({ doctor: { findUnique: jest.fn() } });
const mockEventEmitter = () => ({ emit: jest.fn() });

describe('AppointmentsService — Event Emitter', () => {
  let service: AppointmentsService;
  let apptRepo: ReturnType<typeof mockAppointmentRepo>;
  let emitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: AppointmentRepository, useFactory: mockAppointmentRepo },
        { provide: PetRepository, useFactory: mockPetRepo },
        { provide: ClinicRepository, useFactory: mockClinicRepo },
        { provide: DoctorRepository, useFactory: mockDoctorRepo },
        { provide: PrismaService, useFactory: mockPrismaService },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get(AppointmentsService);
    apptRepo = module.get(AppointmentRepository) as unknown as ReturnType<typeof mockAppointmentRepo>;
    emitter = module.get(EventEmitter2) as unknown as ReturnType<typeof mockEventEmitter>;
  });

  describe('cancel — emits appointment.cancelled', () => {
    it('emits CANCELLED event on successful cancel', async () => {
      const appt = makeAppt({ status: AppointmentStatus.CONFIRMED });
      const cancelled = makeAppt({ status: AppointmentStatus.CANCELLED });
      apptRepo.findRaw.mockResolvedValue(appt);
      apptRepo.update.mockResolvedValue(cancelled);

      await service.cancel('appt-uuid', { reason: 'Change of plans' }, 'owner-id', UserRole.PET_OWNER);

      expect(emitter.emit).toHaveBeenCalledWith(
        AppointmentEvent.CANCELLED,
        expect.objectContaining({ appointmentId: 'appt-uuid', status: AppointmentStatus.CANCELLED }),
      );
    });
  });

  describe('updateStatus — emits correct event per status', () => {
    it('emits CONFIRMED event when status moves to CONFIRMED', async () => {
      const appt = makeAppt({ status: AppointmentStatus.PENDING });
      const confirmed = makeAppt({ status: AppointmentStatus.CONFIRMED });
      apptRepo.findRaw.mockResolvedValue(appt);
      apptRepo.update.mockResolvedValue(confirmed);

      await service.updateStatus(
        'appt-uuid',
        { status: AppointmentStatus.CONFIRMED },
        'admin-id',
        UserRole.SUPER_ADMIN,
      );

      expect(emitter.emit).toHaveBeenCalledWith(
        AppointmentEvent.CONFIRMED,
        expect.objectContaining({ status: AppointmentStatus.CONFIRMED }),
      );
    });

    it('emits COMPLETED event when status moves to COMPLETED', async () => {
      const appt = makeAppt({ status: AppointmentStatus.IN_PROGRESS });
      const completed = makeAppt({ status: AppointmentStatus.COMPLETED });
      apptRepo.findRaw.mockResolvedValue(appt);
      apptRepo.update.mockResolvedValue(completed);

      await service.updateStatus(
        'appt-uuid',
        { status: AppointmentStatus.COMPLETED },
        'admin-id',
        UserRole.SUPER_ADMIN,
      );

      expect(emitter.emit).toHaveBeenCalledWith(
        AppointmentEvent.COMPLETED,
        expect.objectContaining({ status: AppointmentStatus.COMPLETED }),
      );
    });
  });
});
