import { Injectable } from '@nestjs/common';
import { DeliveryAssignment, DeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';

const ASSIGNMENT_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      orderStatus: true,
      address: true,
      items: { include: { product: { select: { name: true, imageUrl: true } } } },
    },
  },
  deliveryPartner: {
    include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
  },
} as const;

@Injectable()
export class AssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.DeliveryAssignmentCreateInput): Promise<DeliveryAssignment> {
    return this.prisma.deliveryAssignment.create({ data, include: ASSIGNMENT_INCLUDE });
  }

  async findById(id: string) {
    return this.prisma.deliveryAssignment.findUnique({ where: { id }, include: ASSIGNMENT_INCLUDE });
  }

  async findByOrderId(orderId: string) {
    return this.prisma.deliveryAssignment.findUnique({ where: { orderId }, include: ASSIGNMENT_INCLUDE });
  }

  async existsByOrderId(orderId: string): Promise<boolean> {
    const count = await this.prisma.deliveryAssignment.count({ where: { orderId } });
    return count > 0;
  }

  async findMany(
    where: Prisma.DeliveryAssignmentWhereInput,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<object>> {
    const { skip, take, page, pageSize } = getPaginationMeta(pagination);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.deliveryAssignment.findMany({
        where,
        skip,
        take,
        include: ASSIGNMENT_INCLUDE,
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.deliveryAssignment.count({ where }),
    ]);

    return buildPaginatedResponse(items as object[], total, page, pageSize);
  }

  async updateStatus(id: string, status: DeliveryStatus, extra?: Prisma.DeliveryAssignmentUpdateInput) {
    return this.prisma.deliveryAssignment.update({
      where: { id },
      data: { status, ...extra },
      include: ASSIGNMENT_INCLUDE,
    });
  }
}
