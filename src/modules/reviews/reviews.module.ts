import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { ShopRepository } from '../shops/shop.repository';
import { ReviewRepository } from './review.repository';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [ClinicsModule, DoctorsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewRepository, ShopRepository],
  exports: [ReviewsService, ReviewRepository],
})
export class ReviewsModule {}
