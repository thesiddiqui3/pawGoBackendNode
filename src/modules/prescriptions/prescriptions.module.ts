import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsRepository } from './prescriptions.repository';
import { PrescriptionsService } from './prescriptions.service';

@Module({
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, PrescriptionsRepository, PrismaService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
