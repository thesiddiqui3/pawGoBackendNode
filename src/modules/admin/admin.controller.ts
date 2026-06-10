import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Response } from 'express';
import { Transform, Type } from 'class-transformer';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/enums';
import { NotificationRepository } from '../notifications/notification.repository';
import { OrderQueryDto } from '../orders/dto/order-query.dto';
import { OrderRepository } from '../orders/order.repository';
import { ShopRepository } from '../shops/shop.repository';
import { ClinicRepository } from '../clinics/clinic.repository';
import { ClinicQueryDto } from '../clinics/dto';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminProvisionService } from './admin-provision.service';
import { AdminUserService } from './admin-user.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

class ProvisionClinicBodyDto {
  @ApiProperty({ example: 'Rahul' })
  @IsString() @IsNotEmpty() ownerFirstName: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString() @IsNotEmpty() ownerLastName: string;

  @ApiProperty({ example: 'rahul@pawcare.com' })
  @IsEmail() ownerEmail: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional() @IsString() ownerPhone?: string;

  @ApiProperty({ example: 'PawCare Veterinary Clinic' })
  @IsString() @IsNotEmpty() @MaxLength(150) clinicName: string;

  @ApiProperty({ example: '+911234567890' })
  @IsString() @IsNotEmpty() clinicPhone: string;

  @ApiProperty({ example: 'VET-MH-2024-001234' })
  @IsString() @IsNotEmpty() licenseNumber: string;

  @ApiProperty({ example: '12 MG Road' })
  @IsString() @IsNotEmpty() address: string;

  @ApiProperty({ example: 'New Delhi' })
  @IsString() @IsNotEmpty() city: string;

  @ApiProperty({ example: 'Delhi' })
  @IsString() @IsNotEmpty() state: string;

  @ApiPropertyOptional({ example: '110001' })
  @IsOptional() @IsString() @Matches(/^\d{4,10}$/) pincode?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @ApiPropertyOptional({ example: 28.6139 })
  @IsOptional() @Type(() => Number) @IsNumber() @IsLatitude() latitude?: number;

  @ApiPropertyOptional({ example: 77.209 })
  @IsOptional() @Type(() => Number) @IsNumber() @IsLongitude() longitude?: number;
}

class ProvisionShopBodyDto {
  @ApiProperty({ example: 'Priya' })
  @IsString() @IsNotEmpty() ownerFirstName: string;

  @ApiProperty({ example: 'Mehta' })
  @IsString() @IsNotEmpty() ownerLastName: string;

  @ApiProperty({ example: 'priya@pawsome.com' })
  @IsEmail() ownerEmail: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional() @IsString() ownerPhone?: string;

  @ApiProperty({ example: 'Pawsome Treats' })
  @IsString() @IsNotEmpty() @MaxLength(120) shopName: string;

  @ApiPropertyOptional({ example: '+911234567890' })
  @IsOptional() @IsString() shopPhone?: string;

  @ApiPropertyOptional({ example: '5 Market Street' })
  @IsOptional() @IsString() address?: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional() @IsString() city?: string;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @IsOptional() @IsString() state?: string;

  @ApiPropertyOptional({ example: '400001' })
  @IsOptional() @IsString() @Matches(/^\d{4,10}$/) pincode?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000) description?: string;

  @ApiPropertyOptional({ example: 28.6139 })
  @IsOptional() @Type(() => Number) @IsNumber() @IsLatitude() latitude?: number;

  @ApiPropertyOptional({ example: 77.209 })
  @IsOptional() @Type(() => Number) @IsNumber() @IsLongitude() longitude?: number;
}

class AdminShopQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() city?: string;

  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() isVerified?: boolean;
}

class AdminPetQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
}

class RevenueQueryDto {
  @ApiPropertyOptional({ description: 'ISO date string e.g. 2026-01-01' })
  @IsOptional() @IsString() from?: string;

  @ApiPropertyOptional({ description: 'ISO date string e.g. 2026-12-31' })
  @IsOptional() @IsString() to?: string;
}

class BroadcastNotificationDto {
  @ApiProperty({ example: 'Scheduled Maintenance' })
  @IsString() @IsNotEmpty() title: string;

  @ApiProperty({ example: 'The app will be down for maintenance from 2am–4am.' })
  @IsString() @IsNotEmpty() message: string;

  @ApiPropertyOptional({ example: 'SYSTEM_ANNOUNCEMENT' })
  @IsOptional() @IsString() type?: string;

  @ApiPropertyOptional({ example: ['PET_OWNER', 'CLINIC_OWNER'], description: 'Target specific roles. Leave empty to broadcast to all.' })
  @IsOptional() @IsArray() @IsString({ each: true }) roles?: string[];
}

class BulkStatusDto {
  @ApiProperty({ example: ['uuid1', 'uuid2'] })
  @IsArray() @IsString({ each: true }) ids: string[];

  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsEnum(['ACTIVE', 'SUSPENDED']) status: 'ACTIVE' | 'SUSPENDED';
}

class AdminNotificationQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({ description: 'ISO date string — filter from' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date string — filter to' })
  @IsOptional()
  @IsString()
  to?: string;
}

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Roles(UserRole.SUPER_ADMIN)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly dashboardSvc: AdminDashboardService,
    private readonly orderRepo: OrderRepository,
    private readonly notificationRepo: NotificationRepository,
    private readonly provisionSvc: AdminProvisionService,
    private readonly adminUserSvc: AdminUserService,
    private readonly shopRepo: ShopRepository,
    private readonly clinicRepo: ClinicRepository,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard stats — users, revenue, trends, top clinics/shops' })
  async dashboard(): Promise<ApiResponseDto<object>> {
    const stats = await this.dashboardSvc.getDashboardStats();
    return ApiResponseDto.success(stats);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List all orders across all shops (admin)' })
  async allOrders(@Query() query: OrderQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.orderRepo.findMany({}, query);
    return ApiResponseDto.success(result);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Notification history across all users (admin)' })
  async allNotifications(@Query() query: AdminNotificationQueryDto): Promise<ApiResponseDto<object>> {
    const { type, userId, isRead, from, to, ...pagination } = query;
    const result = await this.notificationRepo.findAllAdmin({ type, userId, isRead, from, to }, pagination);
    return ApiResponseDto.success(result);
  }

  // ─── Clinic List + Provision ──────────────────────────────────────────────

  @Get('clinics')
  @ApiOperation({ summary: 'List all clinics with filters (admin)' })
  async allClinics(@Query() query: ClinicQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.clinicRepo.findMany(query);
    return ApiResponseDto.success(result);
  }

  @Post('clinics')
  @ApiOperation({ summary: 'Admin: create a clinic owner account + clinic, returns temporary credentials' })
  async provisionClinic(@Body() dto: ProvisionClinicBodyDto): Promise<ApiResponseDto<object>> {
    const result = await this.provisionSvc.provisionClinic(dto);
    return ApiResponseDto.success(result, 'Clinic created. Share credentials with the owner.');
  }

  // ─── Provision Shop ───────────────────────────────────────────────────────

  @Post('shops')
  @ApiOperation({ summary: 'Admin: create a shop owner account + shop, returns temporary credentials' })
  async provisionShop(@Body() dto: ProvisionShopBodyDto): Promise<ApiResponseDto<object>> {
    const result = await this.provisionSvc.provisionShop(dto);
    return ApiResponseDto.success(result, 'Shop created. Share credentials with the owner.');
  }

  // ─── Shop List ────────────────────────────────────────────────────────────

  @Get('shops')
  @ApiOperation({ summary: 'List all verified shops with filters (admin)' })
  async allShops(@Query() query: AdminShopQueryDto): Promise<ApiResponseDto<object>> {
    const shops = await this.shopRepo.findMany({
      search: query.search,
      city: query.city,
      // Default to verified=true so unverified shops only appear in the verification section
      isVerified: query.isVerified !== undefined ? query.isVerified : true,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    });
    return ApiResponseDto.success(shops);
  }

  // ─── User Management ──────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users with filters (admin)' })
  async allUsers(@Query() query: AdminUserQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.listUsers(query);
    return ApiResponseDto.success(result);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getUser(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const user = await this.adminUserSvc.getUser(id);
    return ApiResponseDto.success(user);
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user account (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async suspendUser(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const user = await this.adminUserSvc.setUserStatus(id, 'SUSPENDED');
    return ApiResponseDto.success(user, 'User suspended');
  }

  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Activate a suspended user (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async activateUser(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const user = await this.adminUserSvc.setUserStatus(id, 'ACTIVE');
    return ApiResponseDto.success(user, 'User activated');
  }

  // ─── Doctors / Assistants ─────────────────────────────────────────────────

  @Get('doctors')
  @ApiOperation({ summary: 'List all doctors/assistants across all clinics (admin)' })
  async allDoctors(@Query() query: AdminUserQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.listDoctors(query);
    return ApiResponseDto.success(result);
  }

  // ─── Delivery Partners ────────────────────────────────────────────────────

  @Get('delivery-partners')
  @ApiOperation({ summary: 'List all delivery partners (admin)' })
  async allDeliveryPartners(@Query() query: AdminUserQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.listDeliveryPartners(query);
    return ApiResponseDto.success(result);
  }

  // ─── Pets Overview ────────────────────────────────────────────────────────

  @Get('pets')
  @ApiOperation({ summary: 'List all pets across all owners (admin)' })
  async allPets(@Query() query: AdminPetQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.listPets(query);
    return ApiResponseDto.success(result);
  }

  // ─── Revenue Reports ──────────────────────────────────────────────────────

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue report by date range (admin)' })
  async revenueReport(@Query() query: RevenueQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.getRevenueReport(query);
    return ApiResponseDto.success(result);
  }

  @Get('revenue/export')
  @ApiOperation({ summary: 'Export revenue as CSV (admin)' })
  @Header('Content-Type', 'text/csv')
  async exportRevenueCsv(@Query() query: RevenueQueryDto, @Res() res: Response): Promise<void> {
    const csv = await this.adminUserSvc.getRevenueCsv(query);
    const filename = `revenue_${query.from ?? 'all'}_to_${query.to ?? 'now'}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  // ─── Bulk Actions ─────────────────────────────────────────────────────────

  @Patch('users/bulk-status')
  @ApiOperation({ summary: 'Bulk suspend or activate users (admin)' })
  async bulkUserStatus(@Body() dto: BulkStatusDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.bulkSetUserStatus(dto.ids, dto.status);
    return ApiResponseDto.success(result, `${result.updated} users ${dto.status.toLowerCase()}`);
  }

  // ─── Broadcast Notification ───────────────────────────────────────────────

  @Post('notifications/broadcast')
  @ApiOperation({ summary: 'Broadcast a notification to all users or specific roles (admin)' })
  async broadcast(@Body() dto: BroadcastNotificationDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.broadcastNotification(dto);
    return ApiResponseDto.success(result, `Notification sent to ${result.sent} users`);
  }
}
