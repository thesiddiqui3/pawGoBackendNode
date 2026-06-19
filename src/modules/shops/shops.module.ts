import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../shared/cloudinary/cloudinary.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { ShopRepository } from './shop.repository';
import { ShopsController, ShopReportsController, ShopDashboardController, ShopEarningsController, ShopReviewsController, ShopCustomersController, ShopInventoryController } from './shops.controller';
import { ShopsService } from './shops.service';
import { ShopReportsService } from './shop-reports.service';
import { ShopReviewsService } from './shop-reviews.service';
import { ShopCustomersService } from './shop-customers.service';
import { ShopInventoryService } from './shop-inventory.service';

@Module({
  imports: [CloudinaryModule, ReviewsModule],
  controllers: [ShopsController, ShopReportsController, ShopDashboardController, ShopEarningsController, ShopReviewsController, ShopCustomersController, ShopInventoryController],
  providers: [ShopsService, ShopRepository, ShopReportsService, ShopReviewsService, ShopCustomersService, ShopInventoryService],
  exports: [ShopsService, ShopRepository],
})
export class ShopsModule {}
