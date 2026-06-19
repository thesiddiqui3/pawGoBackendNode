import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreateShopDto, UpdateShopDto } from './dto';
import { ShopsService } from './shops.service';

@ApiTags('Shops')
@Controller({ path: 'shops', version: '1' })
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a shop (shop owner gets one, admins can create multiple)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateShopDto,
  ): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.create(dto, user.sub, user.role);
    return ApiResponseDto.success(shop, 'Shop created');
  }

  @Get('my')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get the current shop owner\'s shop' })
  async findMyShop(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.findMyShop(user.sub);
    return ApiResponseDto.success(shop);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active shops (public)' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findMany(
    @Query('city') city?: string,
    @Query('search') search?: string,
  ): Promise<ApiResponseDto<object>> {
    const shops = await this.shopsService.findMany({ city, search });
    return ApiResponseDto.success(shops);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get shop by ID (public)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.findOne(id);
    return ApiResponseDto.success(shop);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update shop (owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShopDto,
  ): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(shop, 'Shop updated');
  }

  @Patch(':id/suspend')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspend a shop (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.suspend(id, user.sub, user.role);
    return ApiResponseDto.success(shop, 'Shop suspended');
  }

  @Patch(':id/activate')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate a shop (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.activate(id, user.sub, user.role);
    return ApiResponseDto.success(shop, 'Shop activated');
  }
}

// ─── Shop Reports ─────────────────────────────────────────────────────────────

import { ShopReportsService } from './shop-reports.service';

@ApiTags('Shop Reports')
@ApiBearerAuth('access-token')
@Roles(UserRole.SHOP_OWNER)
@Controller({ path: 'my-shop/reports', version: '1' })
export class ShopReportsController {
  constructor(private readonly reportsService: ShopReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get comprehensive shop analytics summary' })
  async getSummary(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.reportsService.getSummary(user.sub));
  }
}

// ─── Shop Dashboard ───────────────────────────────────────────────────────────

@ApiTags('Shop Dashboard')
@ApiBearerAuth('access-token')
@Roles(UserRole.SHOP_OWNER)
@Controller({ path: 'my-shop/dashboard', version: '1' })
export class ShopDashboardController {
  constructor(private readonly reportsService: ShopReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Get full dashboard data (stats, recent orders, low stock, reviews, revenue trend)' })
  async getDashboard(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.reportsService.getDashboard(user.sub));
  }
}

// ─── Shop Earnings ─────────────────────────────────────────────────────────────

@ApiTags('Shop Earnings')
@ApiBearerAuth('access-token')
@Roles(UserRole.SHOP_OWNER)
@Controller({ path: 'my-shop/earnings', version: '1' })
export class ShopEarningsController {
  constructor(private readonly reportsService: ShopReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get earnings summary (revenue, fees, refunds, monthly trend)' })
  async getEarningsSummary(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.reportsService.getEarningsSummary(user.sub));
  }
}

// ─── Shop Reviews ─────────────────────────────────────────────────────────────

import { ShopReviewsService } from './shop-reviews.service';

@ApiTags('Shop Reviews')
@ApiBearerAuth('access-token')
@Roles(UserRole.SHOP_OWNER)
@Controller({ path: 'my-shop/reviews', version: '1' })
export class ShopReviewsController {
  constructor(private readonly shopReviewsService: ShopReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews for the shop owner\'s shop' })
  async findMany(
    @CurrentUser() user: JwtPayload,
    @Query() query: Record<string, any>,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.shopReviewsService.findShopReviews(user.sub, query));
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add reply to a shop review' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async addReply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reply') reply: string,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.shopReviewsService.addReply(id, reply, user.sub));
  }

  @Delete(':id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove reply from a shop review' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async removeReply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.shopReviewsService.removeReply(id, user.sub));
  }
}

// ─── Shop Customers ───────────────────────────────────────────────────────────

import { ShopCustomersService } from './shop-customers.service';

@ApiTags('Shop Customers')
@ApiBearerAuth('access-token')
@Roles(UserRole.SHOP_OWNER)
@Controller({ path: 'my-shop/customers', version: '1' })
export class ShopCustomersController {
  constructor(private readonly shopCustomersService: ShopCustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers who ordered from this shop' })
  async findMany(
    @CurrentUser() user: JwtPayload,
    @Query() query: Record<string, any>,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.shopCustomersService.findCustomers(user.sub, query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single customer with their order history at this shop' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.shopCustomersService.getCustomerById(user.sub, id));
  }
}

// ─── Shop Inventory ───────────────────────────────────────────────────────────

import { ShopInventoryService } from './shop-inventory.service';

@ApiTags('Shop Inventory')
@ApiBearerAuth('access-token')
@Roles(UserRole.SHOP_OWNER)
@Controller({ path: 'my-shop/inventory', version: '1' })
export class ShopInventoryController {
  constructor(private readonly inventoryService: ShopInventoryService) {}

  @Get('products')
  @ApiOperation({ summary: 'List all shop products (incl. inactive) for inventory management' })
  async listProducts(
    @CurrentUser() user: JwtPayload,
    @Query() query: Record<string, any>,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.inventoryService.listProducts(user.sub, query));
  }

  @Patch('products/:id/stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjust stock for a product and record the movement' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body('quantity') quantity: number,
    @Body('reason') reason?: string,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.inventoryService.adjustStock(user.sub, id, Number(quantity), reason));
  }

  @Get('movements')
  @ApiOperation({ summary: 'List stock movement history' })
  async listMovements(
    @CurrentUser() user: JwtPayload,
    @Query() query: Record<string, any>,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.inventoryService.listMovements(user.sub, query));
  }
}
