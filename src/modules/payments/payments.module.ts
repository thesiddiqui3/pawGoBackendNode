import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import razorpayConfig from '../../config/razorpay.config';
import { PrismaModule } from '../../database/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, ConfigModule.forFeature(razorpayConfig)],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
