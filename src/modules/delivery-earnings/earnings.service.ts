import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DeliveryEvent, DeliveryAssignmentEventPayload } from '../../common/events/delivery.events';
import { DeliveryPartnerRepository } from '../delivery-partners/delivery-partner.repository';
import { AssignmentRepository } from '../delivery-assignments/assignment.repository';
import { EarningRepository } from './earning.repository';
import { EarningsQueryDto } from './dto/earnings-query.dto';

const DELIVERY_FEE = 50; // flat delivery fee per order

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(
    private readonly earningRepository: EarningRepository,
    private readonly partnerRepository: DeliveryPartnerRepository,
    private readonly assignmentRepository: AssignmentRepository,
  ) {}

  // ─── Record earning when delivery completes ────────────────────────────────

  @OnEvent(DeliveryEvent.COMPLETED)
  async handleDeliveryCompleted(payload: DeliveryAssignmentEventPayload) {
    try {
      const assignment = await this.assignmentRepository.findById(payload.assignmentId);
      if (!assignment) return;

      await this.earningRepository.create({
        deliveryPartner: { connect: { id: payload.deliveryPartnerId } },
        order: { connect: { id: payload.orderId } },
        amount: DELIVERY_FEE,
        type: 'DELIVERY_FEE',
      });

      await this.partnerRepository.incrementDeliveries(payload.deliveryPartnerId, DELIVERY_FEE);
      this.logger.log(`Earning recorded for partner ${payload.deliveryPartnerId}: ₹${DELIVERY_FEE}`);
    } catch (err) {
      this.logger.error(`Failed to record earning for assignment ${payload.assignmentId}`, err);
    }
  }

  // ─── Partner: list earnings ────────────────────────────────────────────────

  async findMyEarnings(partnerId: string, query: EarningsQueryDto) {
    const where = this.buildWhere(partnerId, query);
    return this.earningRepository.findMany(where, query);
  }

  // ─── Partner: earnings summary ─────────────────────────────────────────────

  async getSummary(partnerId: string) {
    const partner = await this.partnerRepository.findById(partnerId);
    if (!partner) throw new NotFoundException('Delivery partner not found');

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month, total] = await Promise.all([
      this.earningRepository.sumByPeriod(partnerId, todayStart, todayEnd),
      this.earningRepository.sumByPeriod(partnerId, weekStart, now),
      this.earningRepository.sumByPeriod(partnerId, monthStart, now),
      this.earningRepository.sumAll(partnerId),
    ]);

    return { today, week, month, total };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private buildWhere(partnerId: string, query: EarningsQueryDto): Record<string, unknown> {
    const where: Record<string, unknown> = { deliveryPartnerId: partnerId };
    if (query.month !== undefined && query.year !== undefined) {
      const from = new Date(query.year, query.month - 1, 1);
      const to = new Date(query.year, query.month, 1);
      where['createdAt'] = { gte: from, lt: to };
    } else if (query.year !== undefined) {
      const from = new Date(query.year, 0, 1);
      const to = new Date(query.year + 1, 0, 1);
      where['createdAt'] = { gte: from, lt: to };
    }
    return where;
  }
}
