import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ComplaintStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { ComplaintRepository } from './complaint.repository';
import { AssignComplaintDto, UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly repo: ComplaintRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateComplaintDto, userId: string) {
    const complaint = await this.repo.create({
      user: { connect: { id: userId } },
      category: dto.category,
      subject: dto.subject,
      description: dto.description,
      orderId: dto.orderId,
      appointmentId: dto.appointmentId,
    });

    // Auto-assign to the admin with fewest open complaints (fire-and-forget)
    this.autoAssign(complaint.id).catch((err: Error) =>
      this.logger.warn(`Auto-assign failed for complaint ${complaint.id}: ${err?.message}`),
    );

    return complaint;
  }

  private async autoAssign(complaintId: string): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN, deletedAt: null },
      select: { id: true },
    });
    if (admins.length === 0) return;

    const counts = await Promise.all(
      admins.map(async (a) => ({
        id: a.id,
        count: await this.prisma.complaint.count({
          where: {
            assignedTo: a.id,
            status: { notIn: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] },
          },
        }),
      })),
    );

    const picked = counts.reduce((min, cur) => (cur.count < min.count ? cur : min));
    await this.repo.update(complaintId, {
      assignedTo: picked.id,
      status: ComplaintStatus.IN_REVIEW,
    });
  }

  async findAll(query: ComplaintQueryDto, userId: string, role: string) {
    const isAdmin = role === UserRole.SUPER_ADMIN;
    return this.repo.findMany(query, isAdmin ? undefined : userId);
  }

  async findOne(id: string, userId: string, role: string) {
    const complaint = await this.repo.findById(id);
    if (!complaint) throw new NotFoundException('Complaint not found');
    const isAdmin = role === UserRole.SUPER_ADMIN;
    if (!isAdmin && complaint.user.id !== userId) throw new ForbiddenException('Access denied');
    return complaint;
  }

  async updateStatus(id: string, dto: UpdateComplaintStatusDto) {
    const complaint = await this.repo.findById(id);
    if (!complaint) throw new NotFoundException('Complaint not found');

    const resolvedAt =
      dto.status === ComplaintStatus.RESOLVED || dto.status === ComplaintStatus.CLOSED
        ? new Date()
        : undefined;

    return this.repo.update(id, {
      status: dto.status,
      adminNotes: dto.adminNotes,
      ...(resolvedAt ? { resolvedAt } : {}),
    });
  }

  async updatePriority(id: string, priority: string) {
    const complaint = await this.repo.findById(id);
    if (!complaint) throw new NotFoundException('Complaint not found');
    return this.repo.update(id, { priority: priority as any });
  }

  async assign(id: string, dto: AssignComplaintDto) {
    const complaint = await this.repo.findById(id);
    if (!complaint) throw new NotFoundException('Complaint not found');
    return this.repo.update(id, {
      assignedTo: dto.assignedTo,
      status: ComplaintStatus.IN_REVIEW,
    });
  }
}
