import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ComplaintStatus } from '@prisma/client';
import { UserRole } from '../../common/enums';
import { ComplaintRepository } from './complaint.repository';
import { AssignComplaintDto, UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(private readonly repo: ComplaintRepository) {}

  async create(dto: CreateComplaintDto, userId: string) {
    return this.repo.create({
      user: { connect: { id: userId } },
      category: dto.category,
      subject: dto.subject,
      description: dto.description,
      orderId: dto.orderId,
      appointmentId: dto.appointmentId,
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

  async assign(id: string, dto: AssignComplaintDto) {
    const complaint = await this.repo.findById(id);
    if (!complaint) throw new NotFoundException('Complaint not found');
    return this.repo.update(id, {
      assignedTo: dto.assignedTo,
      status: ComplaintStatus.IN_REVIEW,
    });
  }
}
