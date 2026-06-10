import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintCategory, ComplaintStatus } from '@prisma/client';
import { ComplaintRepository } from '../complaint.repository';
import { ComplaintsService } from '../complaints.service';

const mockRepo = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
});

const USER_ID = 'user-uuid';
const ADMIN_ID = 'admin-uuid';
const COMPLAINT_ID = 'complaint-uuid';

const makeComplaint = (overrides: Record<string, unknown> = {}) => ({
  id: COMPLAINT_ID,
  category: ComplaintCategory.ORDER,
  subject: 'Missing item',
  description: 'My order arrived with a missing item.',
  status: ComplaintStatus.OPEN,
  adminNotes: null,
  assignedTo: null,
  resolvedAt: null,
  user: { id: USER_ID, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ComplaintsService', () => {
  let service: ComplaintsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplaintsService,
        { provide: ComplaintRepository, useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(ComplaintsService);
    repo = module.get(ComplaintRepository) as unknown as ReturnType<typeof mockRepo>;
  });

  describe('create', () => {
    it('creates a complaint', async () => {
      repo.create.mockResolvedValue(makeComplaint());
      const result = await service.create(
        { category: ComplaintCategory.ORDER, subject: 'Missing item', description: 'Test' },
        USER_ID,
      );
      expect(repo.create).toHaveBeenCalledTimes(1);
      expect((result as any).id).toBe(COMPLAINT_ID);
    });
  });

  describe('findAll', () => {
    it('admin sees all complaints (no userId filter)', async () => {
      repo.findMany.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
      await service.findAll({}, USER_ID, 'SUPER_ADMIN');
      expect(repo.findMany).toHaveBeenCalledWith({}, undefined);
    });

    it('user sees only their own complaints', async () => {
      repo.findMany.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
      await service.findAll({}, USER_ID, 'PET_OWNER');
      expect(repo.findMany).toHaveBeenCalledWith({}, USER_ID);
    });
  });

  describe('findOne', () => {
    it('returns complaint to owner', async () => {
      repo.findById.mockResolvedValue(makeComplaint());
      const result = await service.findOne(COMPLAINT_ID, USER_ID, 'PET_OWNER');
      expect((result as any).id).toBe(COMPLAINT_ID);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('bad-id', USER_ID, 'PET_OWNER')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a different user', async () => {
      repo.findById.mockResolvedValue(makeComplaint());
      await expect(service.findOne(COMPLAINT_ID, 'other-user', 'PET_OWNER')).rejects.toThrow(ForbiddenException);
    });

    it('admin can access any complaint', async () => {
      repo.findById.mockResolvedValue(makeComplaint());
      const result = await service.findOne(COMPLAINT_ID, 'other-user', 'SUPER_ADMIN');
      expect((result as any).id).toBe(COMPLAINT_ID);
    });
  });

  describe('updateStatus', () => {
    it('updates status and sets resolvedAt for RESOLVED', async () => {
      repo.findById.mockResolvedValue(makeComplaint());
      repo.update.mockResolvedValue(makeComplaint({ status: ComplaintStatus.RESOLVED }));

      await service.updateStatus(COMPLAINT_ID, { status: ComplaintStatus.RESOLVED });
      expect(repo.update).toHaveBeenCalledWith(
        COMPLAINT_ID,
        expect.objectContaining({ status: ComplaintStatus.RESOLVED, resolvedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when complaint not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.updateStatus('bad-id', { status: ComplaintStatus.IN_REVIEW }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assign', () => {
    it('assigns complaint and sets IN_REVIEW status', async () => {
      repo.findById.mockResolvedValue(makeComplaint());
      repo.update.mockResolvedValue(makeComplaint({ assignedTo: ADMIN_ID, status: ComplaintStatus.IN_REVIEW }));

      await service.assign(COMPLAINT_ID, { assignedTo: ADMIN_ID });
      expect(repo.update).toHaveBeenCalledWith(
        COMPLAINT_ID,
        expect.objectContaining({ assignedTo: ADMIN_ID, status: ComplaintStatus.IN_REVIEW }),
      );
    });
  });
});
