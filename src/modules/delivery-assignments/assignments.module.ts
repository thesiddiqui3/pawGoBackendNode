import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';
import { AssignmentRepository } from './assignment.repository';
import { AdminAssignmentsController, AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [EventEmitterModule.forRoot(), DeliveryPartnersModule],
  controllers: [AssignmentsController, AdminAssignmentsController],
  providers: [AssignmentsService, AssignmentRepository],
  exports: [AssignmentsService, AssignmentRepository],
})
export class AssignmentsModule {}
