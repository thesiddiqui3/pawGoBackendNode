import { Injectable } from '@nestjs/common';
import { FieldAgent, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FieldAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, createdAt: true } },
  } satisfies Prisma.FieldAgentInclude;

  async create(data: Prisma.FieldAgentCreateInput): Promise<FieldAgent> {
    return this.prisma.fieldAgent.create({ data, include: this.include });
  }

  async findById(id: string): Promise<FieldAgent | null> {
    return this.prisma.fieldAgent.findUnique({ where: { id }, include: this.include });
  }

  async findByUserId(userId: string): Promise<FieldAgent | null> {
    return this.prisma.fieldAgent.findUnique({ where: { userId }, include: this.include });
  }

  async findMany(params: {
    search?: string;
    assignedCity?: string;
    assignedState?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: FieldAgent[]; total: number }> {
    const { search, assignedCity, assignedState, isActive, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.FieldAgentWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(assignedCity && { assignedCity: { contains: assignedCity, mode: 'insensitive' } }),
      ...(assignedState && { assignedState: { contains: assignedState, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName:  { contains: search, mode: 'insensitive' } } },
          { user: { email:     { contains: search, mode: 'insensitive' } } },
          { assignedCity:  { contains: search, mode: 'insensitive' } },
          { assignedState: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.fieldAgent.findMany({ where, include: this.include, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.fieldAgent.count({ where }),
    ]);
    return { data, total };
  }

  async update(id: string, data: Prisma.FieldAgentUpdateInput): Promise<FieldAgent> {
    return this.prisma.fieldAgent.update({ where: { id }, data, include: this.include });
  }

  async incrementOnboardedClinics(id: string): Promise<void> {
    await this.prisma.fieldAgent.update({
      where: { id },
      data: { clinicsOnboarded: { increment: 1 } },
    });
  }

  async incrementOnboardedShops(id: string): Promise<void> {
    await this.prisma.fieldAgent.update({
      where: { id },
      data: { shopsOnboarded: { increment: 1 } },
    });
  }

  async getOnboardedClinics(agentId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.clinic.findMany({
        where: { onboardedByAgentId: agentId },
        orderBy: { onboardedAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, name: true, city: true, state: true, isVerified: true, isActive: true, onboardedAt: true, createdAt: true },
      }),
      this.prisma.clinic.count({ where: { onboardedByAgentId: agentId } }),
    ]);
    return { data, total };
  }

  async getOnboardedShops(agentId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.shop.findMany({
        where: { onboardedByAgentId: agentId },
        orderBy: { onboardedAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, name: true, city: true, state: true, isVerified: true, isActive: true, onboardedAt: true, createdAt: true },
      }),
      this.prisma.shop.count({ where: { onboardedByAgentId: agentId } }),
    ]);
    return { data, total };
  }
}
