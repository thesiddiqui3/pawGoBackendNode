import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CancelOrderDto, OrderQueryDto } from './dto';
import { OrdersService } from './orders.service';

// ─── Customer order controller ────────────────────────────────────────────────

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('my')
  @ApiOperation({ summary: 'List my orders' })
  async findMyOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: OrderQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.ordersService.findMyOrders(user.sub, query);
    return ApiResponseDto.success(data);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics for the current customer' })
  async getMyStats(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const stats = await this.ordersService.getCustomerStats(user.sub);
    return ApiResponseDto.success(stats);
  }

  @Get('admin/stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get platform-wide order statistics (admin only)' })
  async getAdminStats(): Promise<ApiResponseDto<object>> {
    const stats = await this.ordersService.getAdminStats();
    return ApiResponseDto.success(stats);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all orders (admin only)' })
  async findAll(@Query() query: OrderQueryDto): Promise<ApiResponseDto<object>> {
    const data = await this.ordersService.findAll(query);
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  @Roles(UserRole.PET_OWNER, UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get order detail' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const order = await this.ordersService.findOne(id, user.sub, user.role);
    return ApiResponseDto.success(order);
  }

  @Get(':id/tracking')
  @Roles(UserRole.PET_OWNER, UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get order status timeline / tracking' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getTracking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const timeline = await this.ordersService.getTracking(id, user.sub, user.role);
    return ApiResponseDto.success(timeline);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order (customer can cancel before it is packed)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CancelOrderDto,
  ): Promise<ApiResponseDto<object>> {
    const order = await this.ordersService.cancel(id, dto, user.sub, user.role);
    return ApiResponseDto.success(order, 'Order cancelled');
  }
}

// ─── Shop order controller ────────────────────────────────────────────────────

@ApiTags('Shop Orders')
@ApiBearerAuth('access-token')
@Controller({ path: 'shop/orders', version: '1' })
export class ShopOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List orders for the shop owner\'s shop' })
  async findShopOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: OrderQueryDto,
  ): Promise<ApiResponseDto<object>> {
    // shopId is resolved via the shop lookup in CheckoutService; here owner queries their shop's orders
    // Shop owner's ownerId = user.sub; find shopId from shop
    // For simplicity we pass ownerId and let the service filter via shop relation
    const data = await this.ordersService.findAll({ ...query, shopId: user.sub } as any);
    return ApiResponseDto.success(data);
  }

  @Get('stats')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get shop order statistics' })
  async getShopStats(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const stats = await this.ordersService.getShopStats(user.sub);
    return ApiResponseDto.success(stats);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an order' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const order = await this.ordersService.updateStatus(id, OrderStatus.CONFIRMED, user.sub, user.role, 'Order confirmed');
    return ApiResponseDto.success(order, 'Order confirmed');
  }

  @Patch(':id/packed')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order as packed' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async packed(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const order = await this.ordersService.updateStatus(id, OrderStatus.PACKED, user.sub, user.role, 'Order packed');
    return ApiResponseDto.success(order, 'Order marked as packed');
  }

  @Patch(':id/out-for-delivery')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order as out for delivery' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async outForDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const order = await this.ordersService.updateStatus(id, OrderStatus.OUT_FOR_DELIVERY, user.sub, user.role, 'Out for delivery');
    return ApiResponseDto.success(order, 'Order out for delivery');
  }

  @Patch(':id/delivered')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order as delivered' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async delivered(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const order = await this.ordersService.updateStatus(id, OrderStatus.DELIVERED, user.sub, user.role, 'Delivered to customer');
    return ApiResponseDto.success(order, 'Order delivered');
  }
}
