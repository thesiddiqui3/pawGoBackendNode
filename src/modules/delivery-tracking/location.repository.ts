import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { deliveryPartnerId: string; latitude: number; longitude: number; accuracy?: number }) {
    return this.prisma.locationUpdate.create({ data });
  }

  async findLatestByPartner(deliveryPartnerId: string) {
    return this.prisma.locationUpdate.findFirst({
      where: { deliveryPartnerId },
      orderBy: { timestamp: 'desc' },
    });
  }
}
