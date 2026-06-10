import { Module } from '@nestjs/common';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';
import { AssignmentsModule } from '../delivery-assignments/assignments.module';
import { AutoAssignmentService } from './auto-assignment.service';

@Module({
  imports: [DeliveryPartnersModule, AssignmentsModule],
  providers: [AutoAssignmentService],
  exports: [AutoAssignmentService],
})
export class AutoAssignmentModule {}
