import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const ORDER_INCLUDE_SLIM = {
  items: { include: { product: { select: { id: true, name: true } } } },
  address: { select: { city: true, addressLine1: true, landmark: true } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  timeline: { orderBy: { createdAt: 'asc' as const } },
  deliveryAssignment: {
    include: { deliveryPartner: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
  },
} as const;

@Injectable()
export class ShopReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveShopId(ownerId: string): Promise<string> {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId }, select: { id: true } });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop.id;
  }

  async getEarningsSummary(ownerId: string) {
    const shopId = await this.resolveShopId(ownerId);

    const [revenueAgg, refundAgg, monthlyRows] = await Promise.all([
      this.prisma.order.aggregate({
        where: { shopId, orderStatus: OrderStatus.DELIVERED },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.order.aggregate({
        where: { shopId, orderStatus: OrderStatus.REFUNDED },
        _sum: { totalAmount: true },
      }),
      this.prisma.$queryRaw<{ month: string; revenue: number; orders: bigint }[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "placedAt"), 'Mon ''YY') AS month,
          COALESCE(SUM(CASE WHEN "orderStatus"::text = 'DELIVERED' THEN "totalAmount" ELSE 0 END), 0) AS revenue,
          COUNT(CASE WHEN "orderStatus"::text = 'DELIVERED' THEN 1 END) AS orders
        FROM orders
        WHERE "shopId" = ${shopId}
          AND "placedAt" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "placedAt")
        ORDER BY DATE_TRUNC('month', "placedAt") ASC
      `,
    ]);

    const totalRevenue = Number(revenueAgg._sum.totalAmount ?? 0);
    const refunds = Number(refundAgg._sum.totalAmount ?? 0);
    const platformFees = Math.round(totalRevenue * 0.12);

    return {
      totalRevenue,
      platformFees,
      netRevenue: totalRevenue - platformFees,
      refunds,
      totalDeliveredOrders: revenueAgg._count.id,
      monthlyTrend: monthlyRows.map(r => ({
        month: r.month,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      })),
    };
  }

  async getSummary(ownerId: string) {
    const shopId = await this.resolveShopId(ownerId);

    const [
      orderCounts,
      revenueAgg,
      monthlyRows,
      topProductRows,
      categoryRows,
    ] = await Promise.all([
      // Order status breakdown
      this.prisma.order.groupBy({
        by: ['orderStatus'],
        where: { shopId },
        _count: { id: true },
      }),

      // Total revenue from delivered orders
      this.prisma.order.aggregate({
        where: { shopId, orderStatus: OrderStatus.DELIVERED },
        _sum: { totalAmount: true },
      }),

      // Monthly revenue trend (last 12 months)
      this.prisma.$queryRaw<{ month: string; revenue: number; orders: bigint }[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "placedAt"), 'Mon ''YY') AS month,
          COALESCE(SUM(CASE WHEN "orderStatus"::text = 'DELIVERED' THEN "totalAmount" ELSE 0 END), 0) AS revenue,
          COUNT(*) AS orders
        FROM orders
        WHERE "shopId" = ${shopId}
          AND "placedAt" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "placedAt")
        ORDER BY DATE_TRUNC('month', "placedAt") ASC
      `,

      // Top 10 products by quantity sold
      this.prisma.$queryRaw<{ productId: string; name: string; sold: bigint; revenue: number }[]>`
        SELECT
          oi."productId",
          oi."productName" AS name,
          SUM(oi.quantity) AS sold,
          SUM(oi.subtotal) AS revenue
        FROM order_items oi
        JOIN orders o ON oi."orderId" = o.id
        WHERE o."shopId" = ${shopId}
          AND o."orderStatus"::text = 'DELIVERED'
        GROUP BY oi."productId", oi."productName"
        ORDER BY sold DESC
        LIMIT 10
      `,

      // Revenue by product category
      this.prisma.$queryRaw<{ category: string; orders: bigint; revenue: number }[]>`
        SELECT
          p.category::text,
          SUM(oi.quantity) AS orders,
          SUM(oi.subtotal) AS revenue
        FROM order_items oi
        JOIN orders o ON oi."orderId" = o.id
        JOIN products p ON oi."productId" = p.id
        WHERE o."shopId" = ${shopId}
          AND o."orderStatus"::text = 'DELIVERED'
        GROUP BY p.category
        ORDER BY revenue DESC
        LIMIT 8
      `,
    ]);

    // Build order stats map
    const statsMap: Record<string, number> = {};
    for (const row of orderCounts) {
      statsMap[row.orderStatus] = row._count.id;
    }
    const totalOrders = orderCounts.reduce((s, r) => s + r._count.id, 0);

    const grossRevenue = Number(revenueAgg._sum.totalAmount ?? 0);
    const platformFee  = Math.round(grossRevenue * 0.12);

    return {
      orderStats: {
        totalOrders,
        pendingOrders:   statsMap['PENDING']   ?? 0,
        confirmedOrders: statsMap['CONFIRMED'] ?? 0,
        packedOrders:    statsMap['PACKED']    ?? 0,
        deliveredOrders: statsMap['DELIVERED'] ?? 0,
        cancelledOrders: statsMap['CANCELLED'] ?? 0,
      },
      revenueSummary: {
        totalRevenue: grossRevenue,
        platformFees: platformFee,
        netRevenue:   grossRevenue - platformFee,
        refunds:      0,
      },
      monthlyTrend: monthlyRows.map(r => ({
        month:   r.month,
        revenue: Number(r.revenue),
        orders:  Number(r.orders),
      })),
      topProducts: topProductRows.map(r => ({
        name:    r.name,
        sold:    Number(r.sold),
        revenue: Number(r.revenue),
      })),
      categoryBreakdown: categoryRows.map(r => ({
        name:    r.category,
        orders:  Number(r.orders),
        revenue: Number(r.revenue),
      })),
    };
  }

  async getDashboard(ownerId: string) {
    const shopId = await this.resolveShopId(ownerId);

    const [
      orderStats,
      recentOrders,
      lowStockProducts,
      activeProductCount,
      deliveryPartnersCount,
      avgRatingAgg,
      recentReviews,
      monthlyRows,
    ] = await Promise.all([
      // Order counts & revenue
      this.prisma.order.groupBy({
        by: ['orderStatus'],
        where: { shopId },
        _count: { id: true },
      }).then(rows => {
        const map: Record<string, number> = {};
        for (const r of rows) map[r.orderStatus] = r._count.id;
        return map;
      }),

      // Recent 5 orders
      this.prisma.order.findMany({
        where: { shopId },
        orderBy: { placedAt: 'desc' },
        take: 5,
        include: ORDER_INCLUDE_SLIM,
      }),

      // Low-stock products (stock ≤ 10, not deleted)
      this.prisma.product.findMany({
        where: { shopId, deletedAt: null, stock: { lte: 10 } },
        orderBy: { stock: 'asc' },
        take: 6,
        select: { id: true, name: true, stock: true, isActive: true, category: true, sku: true },
      }),

      // Active product count
      this.prisma.product.count({ where: { shopId, isActive: true, deletedAt: null } }),

      // Delivery partners count (created by this owner)
      this.prisma.deliveryPartner.count({ where: { createdBy: ownerId } }),

      // Average rating from shop reviews
      this.prisma.review.aggregate({
        where: { shopId, targetType: 'SHOP' as any },
        _avg: { rating: true },
        _count: { id: true },
      }),

      // Recent 5 reviews
      this.prisma.review.findMany({
        where: { shopId, targetType: 'SHOP' as any },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),

      // Monthly revenue trend (last 6 months)
      this.prisma.$queryRaw<{ month: string; revenue: number; orders: bigint }[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "placedAt"), 'Mon ''YY') AS month,
          COALESCE(SUM(CASE WHEN "orderStatus"::text = 'DELIVERED' THEN "totalAmount" ELSE 0 END), 0) AS revenue,
          COUNT(CASE WHEN "orderStatus"::text = 'DELIVERED' THEN 1 END) AS orders
        FROM orders
        WHERE "shopId" = ${shopId}
          AND "placedAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "placedAt")
        ORDER BY DATE_TRUNC('month', "placedAt") ASC
      `,
    ]);

    const totalRevenue = await this.prisma.order.aggregate({
      where: { shopId, orderStatus: OrderStatus.DELIVERED },
      _sum: { totalAmount: true },
    });

    return {
      stats: {
        totalOrders:      Object.values(orderStats).reduce((a, b) => a + b, 0),
        pendingOrders:    orderStats['PENDING']   ?? 0,
        confirmedOrders:  orderStats['CONFIRMED'] ?? 0,
        packedOrders:     orderStats['PACKED']    ?? 0,
        deliveredOrders:  orderStats['DELIVERED'] ?? 0,
        cancelledOrders:  orderStats['CANCELLED'] ?? 0,
        monthlyRevenue:   Number(totalRevenue._sum.totalAmount ?? 0),
        activeProducts:   activeProductCount,
        deliveryPartners: deliveryPartnersCount,
        averageRating:    Number(avgRatingAgg._avg.rating ?? 0),
        totalReviews:     avgRatingAgg._count.id,
      },
      revenueTrend: monthlyRows.map(r => ({
        month:   r.month,
        revenue: Number(r.revenue),
        orders:  Number(r.orders),
      })),
      recentOrders,
      lowStockProducts: lowStockProducts.map(p => ({
        id:       p.id,
        name:     p.name,
        stock:    p.stock,
        isActive: p.isActive,
        category: p.category,
        sku:      p.sku,
      })),
      recentReviews: recentReviews.map(r => ({
        id:           r.id,
        customerName: r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || 'Customer' : 'Customer',
        rating:       r.rating,
        comment:      r.comment,
        createdAt:    r.createdAt,
      })),
    };
  }
}
