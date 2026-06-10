import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';
import { AssignmentsModule } from '../delivery-assignments/assignments.module';
import { LocationRepository } from './location.repository';
import { OrderTrackingController, TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [EventEmitterModule.forRoot(), DeliveryPartnersModule, AssignmentsModule],
  controllers: [TrackingController, OrderTrackingController],
  providers: [TrackingService, LocationRepository],
  exports: [TrackingService],
})
export class TrackingModule {}
