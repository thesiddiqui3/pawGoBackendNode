import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ComplaintRepository } from './complaint.repository';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  controllers: [ComplaintsController],
  providers: [ComplaintsService, ComplaintRepository, PrismaService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
