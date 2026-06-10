import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { ComplaintQueryDto } from './dto/complaint-query.dto';

const COMPLAINT_SELECT = {
  id: true,
  category: true,
  subject: true,
  description: true,
  status: true,
  adminNotes: true,
  assignedTo: true,
  resolvedAt: true,
  orderId: true,
  appointmentId: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
} satisfies Prisma.ComplaintSelect;

@Injectable()
export class ComplaintRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ComplaintCreateInput) {
    return this.prisma.complaint.create({ data, select: COMPLAINT_SELECT });
  }

  async findById(id: string) {
    return this.prisma.complaint.findUnique({ where: { id }, select: COMPLAINT_SELECT });
  }

  async findMany(query: ComplaintQueryDto, userId?: string) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    const where: Prisma.ComplaintWhereInput = {
      ...(userId ? { userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? { OR: [{ subject: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({ where, select: COMPLAINT_SELECT, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.complaint.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async update(id: string, data: Prisma.ComplaintUpdateInput) {
    return this.prisma.complaint.update({ where: { id }, data, select: COMPLAINT_SELECT });
  }
}
