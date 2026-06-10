import { Module } from '@nestjs/common';
import { BookingRepository } from './booking.repository';
import { ServiceRepository } from './service.repository';
import { BookingsController, ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  controllers: [ServicesController, BookingsController],
  providers: [ServicesService, ServiceRepository, BookingRepository],
  exports: [ServicesService],
})
export class ServicesModule {}
