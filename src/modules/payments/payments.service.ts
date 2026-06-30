import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;

  /** True when no real Razorpay credentials are configured — skips API calls and signature check. */
  private get isTestMode(): boolean {
    const keyId = this.config.get<string>('razorpay.keyId', '');
    return !keyId || keyId.startsWith('rzp_test_REPLACE') || keyId === '';
  }

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.config.get<string>('razorpay.keyId', 'rzp_test_placeholder'),
      key_secret: this.config.get<string>('razorpay.keySecret', 'placeholder'),
    });
  }

  /**
   * Creates a Razorpay order for the given amount (in paise).
   * In test mode (no credentials), returns a fake order ID so the flow can be tested end-to-end.
   */
  async createRazorpayOrder(amountPaise: number, receipt: string) {
    if (this.isTestMode) {
      const fakeId = `order_TEST_${Date.now()}`;
      this.logger.warn(`TEST MODE: returning fake Razorpay order ${fakeId}`);
      return { razorpayOrderId: fakeId, amount: amountPaise, currency: 'INR', testMode: true };
    }

    const order = await this.razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
    });
    this.logger.log(`Razorpay order created: ${order.id} for ₹${amountPaise / 100}`);
    return { razorpayOrderId: order.id, amount: order.amount, currency: order.currency, testMode: false };
  }

  /**
   * Verifies Razorpay payment signature and marks orders as PAID.
   * In test mode, skips signature verification so you can test with fake IDs.
   */
  async verifyAndCapture(
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string,
    orderIds: string[],
  ) {
    if (orderIds.length === 0) {
      throw new BadRequestException('No order IDs provided');
    }

    if (!this.isTestMode) {
      const keySecret = this.config.get<string>('razorpay.keySecret', '');
      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        throw new BadRequestException('Payment verification failed: invalid signature');
      }
    } else {
      this.logger.warn(`TEST MODE: skipping signature verification for orders [${orderIds.join(', ')}]`);
    }

    const updated = await this.prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: {
        paymentStatus: 'PAID',
        paymentTransactionId: razorpay_payment_id,
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('No matching orders found to update');
    }

    this.logger.log(
      `Payment verified: ${razorpay_payment_id} → ${updated.count} order(s) marked PAID`,
    );
    return { verified: true, paymentId: razorpay_payment_id, ordersUpdated: updated.count };
  }
}
