import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DeliveryPartnerRepository } from './delivery-partner.repository';
import { AdminDeliveryPartnersController, DeliveryPartnersController } from './delivery-partners.controller';
import { DeliveryPartnersService } from './delivery-partners.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [DeliveryPartnersController, AdminDeliveryPartnersController],
  providers: [DeliveryPartnersService, DeliveryPartnerRepository],
  exports: [DeliveryPartnersService, DeliveryPartnerRepository],
})
export class DeliveryPartnersModule {}
