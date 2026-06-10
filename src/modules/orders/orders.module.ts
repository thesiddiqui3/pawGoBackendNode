import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { OrderRepository } from './order.repository';
import { OrdersController, ShopOrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [OrdersController, ShopOrdersController],
  providers: [OrdersService, OrderRepository],
  exports: [OrdersService, OrderRepository],
})
export class OrdersModule {}
