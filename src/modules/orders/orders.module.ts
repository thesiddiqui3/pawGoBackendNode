import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { EmailModule } from '../../shared/email/email.module';
import { OrderEmailListener } from './order-email.listener';
import { OrderRepository } from './order.repository';
import { OrdersController, ShopOrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [EventEmitterModule.forRoot(), EmailModule],
  controllers: [OrdersController, ShopOrdersController],
  providers: [OrdersService, OrderRepository, PrismaService, OrderEmailListener],
  exports: [OrdersService, OrderRepository],
})
export class OrdersModule {}
