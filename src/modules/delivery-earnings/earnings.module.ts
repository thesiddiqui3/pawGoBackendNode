import { Module } from '@nestjs/common';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';
import { AssignmentsModule } from '../delivery-assignments/assignments.module';
import { PrismaModule } from '../../database/prisma.module';
import { EmailModule } from '../../shared/email/email.module';
import { EarningRepository } from './earning.repository';
import { EarningsController } from './earnings.controller';
import { EarningsService } from './earnings.service';

@Module({
  imports: [DeliveryPartnersModule, AssignmentsModule, PrismaModule, EmailModule],
  controllers: [EarningsController],
  providers: [EarningsService, EarningRepository],
  exports: [EarningsService],
})
export class EarningsModule {}
