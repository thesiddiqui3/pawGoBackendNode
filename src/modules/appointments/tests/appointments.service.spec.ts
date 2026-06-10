import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  APPOINTMENT_TRANSITIONS,
  AppointmentStatus,
} from '../../../common/enums/appointment.enum';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PrismaService } from '../../../database/prisma.service';
import { ClinicRepository } from '../../clinics/clinic.repository';
import { DoctorRepository } from '../../doctors/doctor.repository';
import { PetRepository } from '../../pets/pet.repository';
import { AppointmentRepository } from '../appointment.repository';
import { AppointmentsService } from '../appointments.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockAppointmentRepository = () => ({
  generateAppointmentNumber: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findRaw: jest.fn(),
  findMany: jest.fn(),
  existsConflict: jest.fn(),
  getBookedTimes: jest.fn(),
  update: jest.fn(),
  getStats: jest.fn(),
});

const mockPetRepository = () => ({
  findById: jest.fn(),
});

const mockClinicRepository = () => ({
  findById: jest.fn(),
});

const mockDoctorRepository = () => ({
  findById: jest.fn(),
});

const mockPrismaService = () => ({
  doctor: { findUnique: jest.fn() },
});

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const makeAvailability = (day = 'MONDAY', start = '09:00', end = '17:00') => ({
  day,
  startTime: start,
  endTime: end,
  isAvailable: true,
});

const makeDoctor = (overrides = {}) => ({
  id: 'doctor-uuid',
  userId: 'doctor-user-uuid',
  clinicId: 'clinic-uuid',
  isActive: true,
  photoPublicId: null,
  availability: [makeAvailability()],
  ...overrides,
});

const makePet = (overrides = {}) => ({
  id: 'pet-uuid',
  ownerId: 'owner-uuid',
  deletedAt: null,
  ...overrides,
});

const makeClinic = (overrides = {}) => ({
  id: 'clinic-uuid',
  isActive: true,
  deletedAt: null,
  ...overrides,
});

const makeAppointmentRaw = (overrides = {}) => ({
  id: 'appt-uuid',
  appointmentNumber: 'PGA-2026-000001',
  ownerId: 'owner-uuid',
  doctorId: 'doctor-uuid',
  clinicId: 'clinic-uuid',
  petId: 'pet-uuid',
  appointmentDate: new Date('2026-06-16T00:00:00.000Z'), // Monday UTC
  startTime: '10:00',
  endTime: '10:30',
  status: AppointmentStatus.PENDING,
  slotDurationMinutes: 30,
  ...overrides,
});

const makeAppointmentDetail = (overrides = {}) => ({
  ...makeAppointmentRaw(overrides),
  pet: {},
  owner: {},
  clinic: {},
  doctor: {},
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let apptRepo: ReturnType<typeof mockAppointmentRepository>;
  let petRepo: ReturnType<typeof mockPetRepository>;
  let clinicRepo: ReturnType<typeof mockClinicRepository>;
  let doctorRepo: ReturnType<typeof mockDoctorRepository>;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: AppointmentRepository, useFactory: mockAppointmentRepository },
        { provide: PetRepository, useFactory: mockPetRepository },
        { provide: ClinicRepository, useFactory: mockClinicRepository },
        { provide: DoctorRepository, useFactory: mockDoctorRepository },
        { provide: PrismaService, useFactory: mockPrismaService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(AppointmentsService);
    apptRepo = module.get(AppointmentRepository) as unknown as ReturnType<typeof mockAppointmentRepository>;
    petRepo = module.get(PetRepository) as unknown as ReturnType<typeof mockPetRepository>;
    clinicRepo = module.get(ClinicRepository) as unknown as ReturnType<typeof mockClinicRepository>;
    doctorRepo = module.get(DoctorRepository) as unknown as ReturnType<typeof mockDoctorRepository>;
    prisma = module.get(PrismaService) as unknown as ReturnType<typeof mockPrismaService>;
  });

  // ─── Slot generation engine ──────────────────────────────────────────────────

  describe('generateSlots', () => {
    it('generates 30-minute slots between 09:00 and 10:30', () => {
      const slots = service.generateSlots('09:00', '10:30', 30);
      expect(slots).toEqual(['09:00', '09:30', '10:00']);
    });

    it('generates 15-minute slots', () => {
      const slots = service.generateSlots('08:00', '09:00', 15);
      expect(slots).toEqual(['08:00', '08:15', '08:30', '08:45']);
    });

    it('returns empty array when no complete slot fits', () => {
      const slots = service.generateSlots('09:00', '09:20', 30);
      expect(slots).toEqual([]);
    });

    it('generates full day slots (09:00-17:00, 30 min) = 16 slots', () => {
      const slots = service.generateSlots('09:00', '17:00', 30);
      expect(slots).toHaveLength(16);
      expect(slots[0]).toBe('09:00');
      expect(slots[slots.length - 1]).toBe('16:30');
    });
  });

  // ─── Available slots ─────────────────────────────────────────────────────────

  describe('getAvailableSlots', () => {
    it('returns slots excluding booked times', async () => {
      // 2026-06-15 = Monday
      doctorRepo.findById.mockResolvedValue(
        makeDoctor({ availability: [makeAvailability('MONDAY', '09:00', '10:30')] }),
      );
      apptRepo.getBookedTimes.mockResolvedValue(['09:00']);

      const slots = await service.getAvailableSlots('doctor-uuid', { date: '2026-06-15', slotDuration: 30 });
      expect(slots).toEqual(['09:30', '10:00']);
    });

    it('returns empty array when doctor not available that day', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ availability: [] }));
      const slots = await service.getAvailableSlots('doctor-uuid', { date: '2026-06-15', slotDuration: 30 });
      expect(slots).toEqual([]);
    });

    it('throws NotFoundException for inactive doctor', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ isActive: false }));
      await expect(
        service.getAvailableSlots('doctor-uuid', { date: '2026-06-15', slotDuration: 30 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Appointment creation ────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      petId: 'pet-uuid',
      clinicId: 'clinic-uuid',
      doctorId: 'doctor-uuid',
      appointmentDate: '2026-06-15', // Monday
      startTime: '10:00',
      reason: 'Annual vaccination',
    };

    const setupMocks = () => {
      petRepo.findById.mockResolvedValue(makePet());
      clinicRepo.findById.mockResolvedValue(makeClinic());
      doctorRepo.findById.mockResolvedValue(
        makeDoctor({ availability: [makeAvailability('MONDAY', '09:00', '17:00')] }),
      );
      apptRepo.existsConflict.mockResolvedValue(false);
      apptRepo.generateAppointmentNumber.mockResolvedValue('PGA-2026-000001');
      apptRepo.create.mockResolvedValue(makeAppointmentDetail());
    };

    it('creates appointment for pet owner', async () => {
      setupMocks();
      const result = await service.create(dto, 'owner-uuid', UserRole.PET_OWNER);
      expect(result).toMatchObject({ id: 'appt-uuid' });
      expect(apptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentNumber: 'PGA-2026-000001',
          startTime: '10:00',
          endTime: '10:30',
          reason: 'Annual vaccination',
        }),
      );
    });

    it('throws ForbiddenException when owner books for another user\'s pet', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'other-user' }));
      clinicRepo.findById.mockResolvedValue(makeClinic());
      doctorRepo.findById.mockResolvedValue(makeDoctor({ availability: [makeAvailability('MONDAY')] }));

      await expect(service.create(dto, 'owner-uuid', UserRole.PET_OWNER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when doctor unavailable on that day', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      clinicRepo.findById.mockResolvedValue(makeClinic());
      doctorRepo.findById.mockResolvedValue(makeDoctor({ availability: [] }));

      await expect(service.create(dto, 'owner-uuid', UserRole.PET_OWNER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when slot is outside availability hours', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      clinicRepo.findById.mockResolvedValue(makeClinic());
      doctorRepo.findById.mockResolvedValue(
        makeDoctor({ availability: [makeAvailability('MONDAY', '14:00', '18:00')] }),
      );

      await expect(service.create({ ...dto, startTime: '10:00' }, 'owner-uuid', UserRole.PET_OWNER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on double booking', async () => {
      setupMocks();
      apptRepo.existsConflict.mockResolvedValue(true);

      await expect(service.create(dto, 'owner-uuid', UserRole.PET_OWNER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for inactive clinic', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      clinicRepo.findById.mockResolvedValue(makeClinic({ isActive: false }));
      doctorRepo.findById.mockResolvedValue(makeDoctor());

      await expect(service.create(dto, 'owner-uuid', UserRole.PET_OWNER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows admin to book for any pet', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'some-other-owner' }));
      clinicRepo.findById.mockResolvedValue(makeClinic());
      doctorRepo.findById.mockResolvedValue(
        makeDoctor({ availability: [makeAvailability('MONDAY', '09:00', '17:00')] }),
      );
      apptRepo.existsConflict.mockResolvedValue(false);
      apptRepo.generateAppointmentNumber.mockResolvedValue('PGA-2026-000002');
      apptRepo.create.mockResolvedValue(makeAppointmentDetail());

      const result = await service.create(dto, 'admin-uuid', UserRole.SUPER_ADMIN);
      expect(result).toBeDefined();
    });
  });

  // ─── Status transitions ───────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('allows valid transition PENDING → CONFIRMED by admin', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw({ status: AppointmentStatus.PENDING }));
      apptRepo.update.mockResolvedValue(makeAppointmentDetail({ status: AppointmentStatus.CONFIRMED }));

      const result = await service.updateStatus(
        'appt-uuid',
        { status: AppointmentStatus.CONFIRMED },
        'admin-uuid',
        UserRole.SUPER_ADMIN,
      );
      expect((result as any).status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('rejects invalid transition PENDING → COMPLETED', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw({ status: AppointmentStatus.PENDING }));

      await expect(
        service.updateStatus(
          'appt-uuid',
          { status: AppointmentStatus.COMPLETED },
          'admin-uuid',
          UserRole.SUPER_ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects any transition out of COMPLETED terminal status', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw({ status: AppointmentStatus.COMPLETED }));

      const allowed = APPOINTMENT_TRANSITIONS[AppointmentStatus.COMPLETED];
      expect(allowed).toHaveLength(0);

      await expect(
        service.updateStatus(
          'appt-uuid',
          { status: AppointmentStatus.PENDING },
          'admin-uuid',
          UserRole.SUPER_ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when appointment not found', async () => {
      apptRepo.findRaw.mockResolvedValue(null);
      await expect(
        service.updateStatus('bad-id', { status: AppointmentStatus.CONFIRMED }, 'admin-uuid', UserRole.SUPER_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('pet owner can cancel their own appointment', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw({ ownerId: 'owner-uuid', status: AppointmentStatus.CONFIRMED }));
      apptRepo.update.mockResolvedValue(makeAppointmentDetail({ status: AppointmentStatus.CANCELLED }));

      const result = await service.updateStatus(
        'appt-uuid',
        { status: AppointmentStatus.CANCELLED },
        'owner-uuid',
        UserRole.PET_OWNER,
      );
      expect((result as any).status).toBe(AppointmentStatus.CANCELLED);
    });

    it('throws ForbiddenException when non-owner tries to update status', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw({ ownerId: 'owner-uuid' }));
      prisma.doctor.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'appt-uuid',
          { status: AppointmentStatus.CONFIRMED },
          'other-uuid',
          UserRole.PET_OWNER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Reschedule ───────────────────────────────────────────────────────────────

  describe('reschedule', () => {
    it('reschedules appointment to a new available slot', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw());
      doctorRepo.findById.mockResolvedValue(
        makeDoctor({ availability: [makeAvailability('FRIDAY', '09:00', '17:00')] }),
      );
      apptRepo.existsConflict.mockResolvedValue(false);
      apptRepo.update.mockResolvedValue(
        makeAppointmentDetail({ appointmentDate: new Date('2026-06-19'), startTime: '14:00' }),
      );

      const result = await service.reschedule(
        'appt-uuid',
        { appointmentDate: '2026-06-19', startTime: '14:00' },
        'owner-uuid',
        UserRole.PET_OWNER,
      );
      expect(apptRepo.update).toHaveBeenCalledWith(
        'appt-uuid',
        expect.objectContaining({ startTime: '14:00', status: AppointmentStatus.PENDING }),
      );
      expect(result).toBeDefined();
    });

    it('throws BadRequestException when rescheduling a COMPLETED appointment', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw({ status: AppointmentStatus.COMPLETED }));

      await expect(
        service.reschedule('appt-uuid', { appointmentDate: '2026-06-20', startTime: '10:00' }, 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on double booking conflict', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw());
      doctorRepo.findById.mockResolvedValue(
        makeDoctor({ availability: [makeAvailability('FRIDAY', '09:00', '17:00')] }),
      );
      apptRepo.existsConflict.mockResolvedValue(true);

      await expect(
        service.reschedule('appt-uuid', { appointmentDate: '2026-06-19', startTime: '14:00' }, 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException for non-owner', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw({ ownerId: 'owner-uuid' }));
      await expect(
        service.reschedule('appt-uuid', { appointmentDate: '2026-06-20', startTime: '10:00' }, 'other-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Cancel ───────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels a PENDING appointment', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw());
      apptRepo.update.mockResolvedValue(
        makeAppointmentDetail({ status: AppointmentStatus.CANCELLED, cancellationReason: 'Pet unwell' }),
      );

      const result = await service.cancel('appt-uuid', { reason: 'Pet unwell' }, 'owner-uuid', UserRole.PET_OWNER);
      expect(apptRepo.update).toHaveBeenCalledWith(
        'appt-uuid',
        expect.objectContaining({ status: AppointmentStatus.CANCELLED, cancellationReason: 'Pet unwell' }),
      );
      expect(result).toBeDefined();
    });

    it('throws BadRequestException when cancelling a COMPLETED appointment', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw({ status: AppointmentStatus.COMPLETED }));
      await expect(
        service.cancel('appt-uuid', {}, 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException for non-owner', async () => {
      apptRepo.findRaw.mockResolvedValue(makeAppointmentRaw({ ownerId: 'owner-uuid' }));
      await expect(
        service.cancel('appt-uuid', {}, 'other-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
