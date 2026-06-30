import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationRepository } from '../notifications/notification.repository';
import { OrderRepository } from '../orders/order.repository';
import { ShopRepository } from '../shops/shop.repository';
import { ClinicRepository } from '../clinics/clinic.repository';
import { ReviewsService } from '../reviews/reviews.service';
import { ReviewRepository } from '../reviews/review.repository';
import { DoctorRepository } from '../doctors/doctor.repository';
import { ComplaintsService } from '../complaints/complaints.service';
import { ComplaintRepository } from '../complaints/complaint.repository';
import { AppointmentRepository } from '../appointments/appointment.repository';
import { ClinicsModule } from '../clinics/clinics.module';
import { ShopsModule } from '../shops/shops.module';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';
import { ProductsModule } from '../products/products.module';
import { VerificationDocsModule } from '../verification-docs/verification-docs.module';
import { ServicesModule } from '../services/services.module';
import { EmailModule } from '../../shared/email/email.module';
import { FieldAgentsModule } from '../field-agents/field-agents.module';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminProvisionService } from './admin-provision.service';
import { AdminUserService } from './admin-user.service';

@Module({
  imports: [ClinicsModule, ShopsModule, DeliveryPartnersModule, ProductsModule, VerificationDocsModule, ServicesModule, EmailModule, ConfigModule, FieldAgentsModule],
  controllers: [AdminController],
  providers: [
    AdminDashboardService,
    OrderRepository,
    NotificationRepository,
    AdminProvisionService,
    AdminUserService,
    ShopRepository,
    ClinicRepository,
    ReviewsService,
    ReviewRepository,
    DoctorRepository,
    ComplaintsService,
    ComplaintRepository,
    AppointmentRepository,
  ],
  exports: [AdminDashboardService],
})
export class AdminModule {}
