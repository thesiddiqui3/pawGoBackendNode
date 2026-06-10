import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import appConfig from './config/app.config';
import cloudinaryConfig from './config/cloudinary.config';
import databaseConfig from './config/database.config';
import emailConfig from './config/email.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';

import { PrismaModule } from './database/prisma.module';
import { CloudinaryModule } from './shared/cloudinary/cloudinary.module';
import { EmailModule } from './shared/email/email.module';
import { LoggerModule } from './shared/logger/logger.module';
import { RedisModule } from './shared/redis/redis.module';

import { GlobalExceptionFilter } from './common/filters';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { ResponseInterceptor } from './common/interceptors';
import { LoggerMiddleware } from './common/middleware';

import { BullModule } from '@nestjs/bull';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AssignmentsModule } from './modules/delivery-assignments/assignments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ServicesModule } from './modules/services/services.module';
import { AdminModule } from './modules/admin/admin.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { VerificationModule } from './modules/verification/verification.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { VerificationDocsModule } from './modules/verification-docs/verification-docs.module';
import { StaffModule } from './modules/staff/staff.module';
import { AutoAssignmentModule } from './modules/auto-assignment/auto-assignment.module';
import { DeliveryPartnersModule } from './modules/delivery-partners/delivery-partners.module';
import { EarningsModule } from './modules/delivery-earnings/earnings.module';
import { RatingsModule } from './modules/delivery-ratings/ratings.module';
import { TrackingModule } from './modules/delivery-tracking/tracking.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { ShopsModule } from './modules/shops/shops.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { HealthModule } from './modules/health/health.module';
import { AppointmentNotesModule } from './modules/appointment-notes/appointment-notes.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { PetGalleryModule } from './modules/pet-gallery/pet-gallery.module';
import { PetsModule } from './modules/pets/pets.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UsersModule } from './modules/users/users.module';
import { VaccinationsModule } from './modules/vaccinations/vaccinations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, cloudinaryConfig, emailConfig],
      cache: true,
    }),

    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
            limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
          },
        ],
      }),
    }),

    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        },
      }),
    }),

    PrismaModule,
    RedisModule,
    LoggerModule,
    EmailModule,
    CloudinaryModule,

    HealthModule,
    AuthModule,
    UsersModule,
    PetsModule,
    ClinicsModule,
    DoctorsModule,
    ReviewsModule,
    AppointmentsModule,
    VaccinationsModule,
    MedicalRecordsModule,
    PetGalleryModule,
    AppointmentNotesModule,
    AddressesModule,
    DeliveryPartnersModule,
    AssignmentsModule,
    TrackingModule,
    RatingsModule,
    EarningsModule,
    AutoAssignmentModule,
    ShopsModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    CheckoutModule,
    NotificationsModule,
    ServicesModule,
    AdminModule,
    ComplaintsModule,
    AuditLogsModule,
    VerificationModule,
    SystemSettingsModule,
    VerificationDocsModule,
    StaffModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // JWT guard applied globally — use @Public() to opt out
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Force password change for provisioned clinic/shop owner accounts
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    // Rate limiting applied globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
