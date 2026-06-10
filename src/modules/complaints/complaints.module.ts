import { Module } from '@nestjs/common';
import { ComplaintRepository } from './complaint.repository';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  controllers: [ComplaintsController],
  providers: [ComplaintsService, ComplaintRepository],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
