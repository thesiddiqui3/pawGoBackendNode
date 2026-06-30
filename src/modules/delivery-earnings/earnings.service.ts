import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DeliveryEvent, DeliveryAssignmentEventPayload } from '../../common/events/delivery.events';
import { DeliveryPartnerRepository } from '../delivery-partners/delivery-partner.repository';
import { AssignmentRepository } from '../delivery-assignments/assignment.repository';
import { EMAIL_SERVICE, IEmailService } from '../../shared/email/email.interface';
import { emailTemplates } from '../../shared/email/email-templates';
import { EarningRepository } from './earning.repository';
import { EarningsQueryDto } from './dto/earnings-query.dto';
import { UpdateBankAccountDto, RequestPayoutDto, AdminPayoutActionDto } from './dto/payout.dto';
import { PrismaService } from '../../database/prisma.service';

const DELIVERY_FEE = 50; // flat delivery fee per order

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(
    private readonly earningRepository: EarningRepository,
    private readonly partnerRepository: DeliveryPartnerRepository,
    private readonly assignmentRepository: AssignmentRepository,
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
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

  // ─── Bank account ──────────────────────────────────────────────────────────

  async updateBankAccount(partnerId: string, dto: UpdateBankAccountDto) {
    const partner = await this.partnerRepository.findById(partnerId);
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return this.partnerRepository.update(partnerId, {
      bankName: dto.bankName,
      bankAccount: dto.bankAccount,
      bankIfsc: dto.bankIfsc,
    });
  }

  async getBankAccount(partnerId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      select: { bankName: true, bankAccount: true, bankIfsc: true },
    });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return partner;
  }

  // ─── Payout requests ──────────────────────────────────────────────────────

  async requestPayout(partnerId: string, dto: RequestPayoutDto) {
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      select: { bankName: true, bankAccount: true, bankIfsc: true, totalEarnings: true },
    });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    if (!partner.bankAccount) {
      throw new BadRequestException('Set up your bank account before requesting a payout');
    }

    // Check no pending payout already exists
    const pending = await this.prisma.payoutRequest.findFirst({
      where: { deliveryPartnerId: partnerId, status: 'PENDING' },
    });
    if (pending) throw new BadRequestException('You already have a pending payout request');

    if (dto.amount > partner.totalEarnings) {
      throw new BadRequestException('Requested amount exceeds total earnings');
    }

    return this.prisma.payoutRequest.create({
      data: {
        deliveryPartnerId: partnerId,
        amount: dto.amount,
        bankName: partner.bankName!,
        bankAccount: partner.bankAccount!,
        bankIfsc: partner.bankIfsc!,
      },
    });
  }

  async listMyPayouts(partnerId: string) {
    return this.prisma.payoutRequest.findMany({
      where: { deliveryPartnerId: partnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Admin: manage payouts ─────────────────────────────────────────────────

  async adminListPayouts(status?: string) {
    return this.prisma.payoutRequest.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        deliveryPartner: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
    });
  }

  async adminProcessPayout(payoutId: string, adminId: string, dto: AdminPayoutActionDto) {
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutId },
      include: {
        deliveryPartner: {
          select: { user: { select: { firstName: true, email: true } } },
        },
      },
    });
    if (!payout) throw new NotFoundException('Payout request not found');
    if (payout.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING payouts can be actioned');
    }

    const updated = await this.prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: dto.status,
        adminNote: dto.adminNote,
        processedBy: adminId,
        processedAt: new Date(),
      },
    });

    const user = (payout as any).deliveryPartner?.user;
    if (user?.email) {
      const html = emailTemplates.payoutProcessed(
        user.firstName ?? 'Partner',
        dto.status as 'APPROVED' | 'REJECTED' | 'PAID',
        payout.amount,
        dto.adminNote,
      );
      this.emailService
        .send({
          to: user.email,
          subject: `Payout ${dto.status} — PawGo`,
          html,
        })
        .catch((err: Error) =>
          this.logger.error(`payout email failed for ${payoutId}: ${err?.message}`),
        );
    }

    return updated;
  }
}
