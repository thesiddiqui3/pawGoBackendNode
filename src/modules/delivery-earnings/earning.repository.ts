import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';

@Injectable()
export class EarningRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.EarningCreateInput) {
    return this.prisma.earning.create({ data });
  }

  async findMany(
    where: Prisma.EarningWhereInput,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<object>> {
    const { skip, take, page, pageSize } = getPaginationMeta(pagination);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.earning.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { orderNumber: true } } },
      }),
      this.prisma.earning.count({ where }),
    ]);

    return buildPaginatedResponse(items as object[], total, page, pageSize);
  }

  async sumByPeriod(deliveryPartnerId: string, from: Date, to: Date): Promise<number> {
    const result = await this.prisma.earning.aggregate({
      where: { deliveryPartnerId, createdAt: { gte: from, lt: to } },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  async sumAll(deliveryPartnerId: string): Promise<number> {
    const result = await this.prisma.earning.aggregate({
      where: { deliveryPartnerId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }
}
