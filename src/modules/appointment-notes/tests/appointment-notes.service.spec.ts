import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../common/enums';
import { AppointmentStatus } from '../../../common/enums/appointment.enum';
import { AppointmentRepository } from '../../appointments/appointment.repository';
import { AppointmentNoteRepository } from '../appointment-note.repository';
import { AppointmentNotesService } from '../appointment-notes.service';

const mockNoteRepo = () => ({
  create: jest.fn(),
  findByAppointment: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  existsByAppointment: jest.fn(),
});

const mockAppointmentRepo = () => ({
  findById: jest.fn(),
  findRaw: jest.fn(),
});

const makeAppointment = (overrides: Record<string, unknown> = {}) => ({
  id: 'appt-uuid',
  appointmentNumber: 'PGA-2026-000001',
  ownerId: 'owner-id',
  doctorId: 'doc-uuid',
  clinicId: 'clinic-uuid',
  petId: 'pet-uuid',
  status: AppointmentStatus.IN_PROGRESS,
  appointmentDate: new Date('2026-06-20'),
  startTime: '10:00',
  ...overrides,
});

const makeNote = (overrides: Record<string, unknown> = {}) => ({
  id: 'note-uuid',
  appointmentId: 'appt-uuid',
  doctorId: 'doc-uuid',
  diagnosis: 'Mild cold',
  treatment: 'Rest',
  medications: ['Amoxicillin'],
  followUpRequired: false,
  followUpDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AppointmentNotesService', () => {
  let service: AppointmentNotesService;
  let noteRepo: ReturnType<typeof mockNoteRepo>;
  let apptRepo: ReturnType<typeof mockAppointmentRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentNotesService,
        { provide: AppointmentNoteRepository, useFactory: mockNoteRepo },
        { provide: AppointmentRepository, useFactory: mockAppointmentRepo },
      ],
    }).compile();

    service = module.get(AppointmentNotesService);
    noteRepo = module.get(AppointmentNoteRepository) as unknown as ReturnType<typeof mockNoteRepo>;
    apptRepo = module.get(AppointmentRepository) as unknown as ReturnType<typeof mockAppointmentRepo>;
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { diagnosis: 'Mild cold', treatment: 'Rest', medications: ['Amoxicillin'] };

    it('allows a doctor to add notes to an IN_PROGRESS appointment', async () => {
      apptRepo.findById.mockResolvedValue(makeAppointment());
      noteRepo.existsByAppointment.mockResolvedValue(false);
      noteRepo.create.mockResolvedValue(makeNote());

      const result = await service.create('appt-uuid', dto, 'doc-user-id', UserRole.ASSISTANT);
      expect(result).toMatchObject({ diagnosis: 'Mild cold' });
      expect(noteRepo.create).toHaveBeenCalledWith('appt-uuid', 'doc-uuid', dto);
    });

    it('allows admin to add notes', async () => {
      apptRepo.findById.mockResolvedValue(makeAppointment({ status: AppointmentStatus.COMPLETED }));
      noteRepo.existsByAppointment.mockResolvedValue(false);
      noteRepo.create.mockResolvedValue(makeNote());

      await expect(
        service.create('appt-uuid', dto, 'admin-id', UserRole.SUPER_ADMIN),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException when a note already exists', async () => {
      apptRepo.findById.mockResolvedValue(makeAppointment());
      noteRepo.existsByAppointment.mockResolvedValue(true);

      await expect(
        service.create('appt-uuid', dto, 'doc-id', UserRole.ASSISTANT),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when appointment is in PENDING status', async () => {
      apptRepo.findById.mockResolvedValue(makeAppointment({ status: AppointmentStatus.PENDING }));
      noteRepo.existsByAppointment.mockResolvedValue(false);

      await expect(
        service.create('appt-uuid', dto, 'doc-id', UserRole.ASSISTANT),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when appointment not found', async () => {
      apptRepo.findById.mockResolvedValue(null);

      await expect(
        service.create('bad-id', dto, 'doc-id', UserRole.ASSISTANT),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for non-doctor non-admin', async () => {
      apptRepo.findById.mockResolvedValue(makeAppointment());
      noteRepo.existsByAppointment.mockResolvedValue(false);

      await expect(
        service.create('appt-uuid', dto, 'owner-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── findByAppointment ────────────────────────────────────────────────────

  describe('findByAppointment', () => {
    it('returns the note for the appointment owner', async () => {
      apptRepo.findById.mockResolvedValue(makeAppointment());
      noteRepo.findByAppointment.mockResolvedValue(makeNote());

      const result = await service.findByAppointment('appt-uuid', 'owner-id', UserRole.PET_OWNER);
      expect(result).toMatchObject({ id: 'note-uuid' });
    });

    it('returns null when no note exists', async () => {
      apptRepo.findById.mockResolvedValue(makeAppointment());
      noteRepo.findByAppointment.mockResolvedValue(null);

      const result = await service.findByAppointment('appt-uuid', 'owner-id', UserRole.PET_OWNER);
      expect(result).toBeNull();
    });

    it('throws ForbiddenException for unrelated PET_OWNER', async () => {
      apptRepo.findById.mockResolvedValue(makeAppointment({ ownerId: 'real-owner' }));

      await expect(
        service.findByAppointment('appt-uuid', 'intruder-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when appointment not found', async () => {
      apptRepo.findById.mockResolvedValue(null);
      await expect(
        service.findByAppointment('bad-id', 'owner-id', UserRole.PET_OWNER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto = { diagnosis: 'Updated diagnosis' };

    it('allows doctor to update note', async () => {
      noteRepo.findById.mockResolvedValue(makeNote());
      apptRepo.findById.mockResolvedValue(makeAppointment());
      noteRepo.update.mockResolvedValue(makeNote({ diagnosis: 'Updated diagnosis' }));

      const result = await service.update('note-uuid', dto, 'doc-id', UserRole.ASSISTANT);
      expect((result as any).diagnosis).toBe('Updated diagnosis');
    });

    it('throws NotFoundException when note not found', async () => {
      noteRepo.findById.mockResolvedValue(null);
      await expect(
        service.update('bad-id', dto, 'doc-id', UserRole.ASSISTANT),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for pet owner trying to update note', async () => {
      noteRepo.findById.mockResolvedValue(makeNote());
      apptRepo.findById.mockResolvedValue(makeAppointment());

      await expect(
        service.update('note-uuid', dto, 'owner-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
