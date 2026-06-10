import { Module } from '@nestjs/common';
import { NotificationRepository } from '../notifications/notification.repository';
import { OrderRepository } from '../orders/order.repository';
import { ShopRepository } from '../shops/shop.repository';
import { ClinicRepository } from '../clinics/clinic.repository';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminProvisionService } from './admin-provision.service';
import { AdminUserService } from './admin-user.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminDashboardService,
    OrderRepository,
    NotificationRepository,
    AdminProvisionService,
    AdminUserService,
    ShopRepository,
    ClinicRepository,
  ],
  exports: [AdminDashboardService],
})
export class AdminModule {}
