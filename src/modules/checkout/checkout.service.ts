import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrderEvent, OrderEventPayload } from '../../common/events/order.events';
import { AddressRepository } from '../addresses/address.repository';
import { CartRepository } from '../cart/cart.repository';
import { CartService } from '../cart/cart.service';
import { ProductRepository } from '../products/product.repository';
import { OrderRepository } from '../orders/order.repository';
import { CheckoutDto } from './dto/checkout.dto';

interface ShopBucket {
  shopId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly cartRepository: CartRepository,
    private readonly cartService: CartService,
    private readonly productRepository: ProductRepository,
    private readonly addressRepository: AddressRepository,
    private readonly orderRepository: OrderRepository,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async checkout(userId: string, dto: CheckoutDto): Promise<Order[]> {
    // 1. Validate address belongs to user
    const address = await this.addressRepository.findById(dto.addressId);
    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    // 2. Load cart
    const cart = await this.cartRepository.findByUser(userId);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 3. Refresh prices and validate stock for all items
    const enrichedItems: Array<{
      productId: string;
      productName: string;
      shopId: string;
      shopName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }> = [];

    for (const item of cart.items) {
      const product = await this.productRepository.findById(item.productId);
      if (!product || product.deletedAt || !product.isActive) {
        throw new BadRequestException(
          `Product "${item.product.name}" is no longer available. Please remove it from your cart.`,
        );
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}.`,
        );
      }
      const unitPrice = product.salePrice ?? product.price;
      enrichedItems.push({
        productId: product.id,
        productName: product.name,
        shopId: product.shopId,
        shopName: item.product.shop.name,
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity,
      });
    }

    // 4. Group items by shop (one order per shop)
    const shopBuckets = new Map<string, ShopBucket>();
    for (const item of enrichedItems) {
      if (!shopBuckets.has(item.shopId)) {
        shopBuckets.set(item.shopId, { shopId: item.shopId, items: [], subtotal: 0 });
      }
      const bucket = shopBuckets.get(item.shopId)!;
      bucket.items.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      });
      bucket.subtotal += item.subtotal;
    }

    // 5. Create orders + deduct stock in a single transaction
    const createdOrders: Order[] = [];

    await this.prisma.$transaction(async (tx) => {
      // Deduct stock for all products atomically
      for (const item of enrichedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Create one order per shop
      for (const [, bucket] of shopBuckets) {
        const orderNumber = await this.orderRepository.generateOrderNumber();
        const shipping = 0; // flat shipping — can be extended
        const tax = 0;
        const discount = 0;
        const totalAmount = bucket.subtotal + shipping + tax - discount;

        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: userId,
            shopId: bucket.shopId,
            addressId: dto.addressId,
            paymentMethod: dto.paymentMethod,
            paymentStatus: 'PENDING',
            orderStatus: OrderStatus.PENDING,
            subtotal: bucket.subtotal,
            discount,
            tax,
            shipping,
            totalAmount,
            notes: dto.notes,
            placedAt: new Date(),
            createdBy: userId,
            items: {
              create: bucket.items.map((i) => ({
                productId: i.productId,
                productName: i.productName,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                subtotal: i.subtotal,
              })),
            },
            timeline: {
              create: {
                status: OrderStatus.PENDING,
                createdBy: userId,
                remarks: 'Order placed',
              },
            },
          },
        });
        createdOrders.push(order as unknown as Order);
      }

      // Clear the cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    });

    // 6. Emit events outside the transaction
    for (const order of createdOrders) {
      this.emitOrderEvent(OrderEvent.CREATED, order);
      this.logger.log(`Order created: ${order.orderNumber} for shop ${order.shopId}`);
    }

    return createdOrders;
  }

  private emitOrderEvent(event: OrderEvent, order: Order): void {
    const payload: OrderEventPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      shopId: order.shopId,
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
    };
    this.eventEmitter.emit(event, payload);
  }
}
