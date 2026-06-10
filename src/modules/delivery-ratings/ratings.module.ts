import { Module } from '@nestjs/common';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';
import { AssignmentsModule } from '../delivery-assignments/assignments.module';
import { RatingRepository } from './rating.repository';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [DeliveryPartnersModule, AssignmentsModule],
  controllers: [RatingsController],
  providers: [RatingsService, RatingRepository],
  exports: [RatingsService],
})
export class RatingsModule {}
