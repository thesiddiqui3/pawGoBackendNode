import { Body, Controller, Delete, Get, Header, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
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
import { ReviewsService } from '../reviews/reviews.service';
import { ReviewQueryDto } from '../reviews/dto';
import { ComplaintsService } from '../complaints/complaints.service';
import { ComplaintQueryDto } from '../complaints/dto/complaint-query.dto';
import { AppointmentRepository } from '../appointments/appointment.repository';
import { AppointmentQueryDto } from '../appointments/dto/appointment-query.dto';
import { ClinicsService } from '../clinics/clinics.service';
import { UpdateClinicDto } from '../clinics/dto/update-clinic.dto';
import { ShopsService } from '../shops/shops.service';
import { UpdateShopDto } from '../shops/dto/update-shop.dto';
import { DeliveryPartnerRepository } from '../delivery-partners/delivery-partner.repository';
import { UpdateComplaintPriorityDto, UpdateComplaintStatusDto } from '../complaints/dto/update-complaint-status.dto';
import { DoctorRepository } from '../doctors/doctor.repository';
import { CancelAppointmentDto } from '../appointments/dto/cancel-appointment.dto';
import { AppointmentStatus, OrderStatus, ServiceBookingStatus } from '@prisma/client';
import { ProductsService } from '../products/products.service';
import { ProductQueryDto } from '../products/dto/product-query.dto';
import { VerificationDocsService } from '../verification-docs/verification-docs.service';
import { ReviewDocDto } from '../verification-docs/dto/upload-doc.dto';
import { BookingRepository } from '../services/booking.repository';
import { BookingQueryDto, ServiceQueryDto, CreateServiceDto, UpdateServiceDto } from '../services/dto';
import { ServiceRepository } from '../services/service.repository';

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

  @ApiPropertyOptional({ description: 'Field agent ID who onboarded this clinic' })
  @IsOptional() @IsString() onboardedByAgentId?: string;
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

  @ApiPropertyOptional({ description: 'Field agent ID who onboarded this shop' })
  @IsOptional() @IsString() onboardedByAgentId?: string;
}

class AdminShopQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() city?: string;

  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined) @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined) @IsBoolean() isVerified?: boolean;
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

class AdminUpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}

class AdminOrderStatusDto {
  @ApiProperty({ enum: OrderStatus }) @IsEnum(OrderStatus) status: OrderStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

class AdminCreateServiceDto extends CreateServiceDto {
  @ApiProperty({ description: 'Clinic this service belongs to' })
  @IsString() @IsNotEmpty() clinicId: string;

  @ApiPropertyOptional({ description: 'Alias for price (frontend compatibility)' })
  @IsOptional() @IsNumber() basePrice?: number;
}

class AdminUpdateServiceDto extends UpdateServiceDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() basePrice?: number;
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
    private readonly reviewsSvc: ReviewsService,
    private readonly complaintsSvc: ComplaintsService,
    private readonly appointmentRepo: AppointmentRepository,
    private readonly clinicsSvc: ClinicsService,
    private readonly shopsSvc: ShopsService,
    private readonly deliveryPartnerRepo: DeliveryPartnerRepository,
    private readonly doctorRepo: DoctorRepository,
    private readonly productsSvc: ProductsService,
    private readonly verificationDocsSvc: VerificationDocsService,
    private readonly bookingRepo: BookingRepository,
    private readonly serviceRepo: ServiceRepository,
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

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getOrder(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const order = await this.orderRepo.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return ApiResponseDto.success(order);
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
  async allClinics(@Query() query: ClinicQueryDto, @Query('verified') verifiedRaw?: string): Promise<ApiResponseDto<object>> {
    const verifiedParsed = verifiedRaw === 'false' ? false : verifiedRaw === 'true' ? true : undefined;
    const result = await this.clinicRepo.findMany({ ...query, ...(verifiedParsed !== undefined && { verified: verifiedParsed }) });
    return ApiResponseDto.success(result);
  }

  @Get('clinics/:id')
  @ApiOperation({ summary: 'Get clinic detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getClinic(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicRepo.findById(id);
    if (!clinic) throw new NotFoundException('Clinic not found');
    return ApiResponseDto.success(clinic);
  }

  @Patch('clinics/:id')
  @ApiOperation({ summary: 'Update clinic details (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateClinic(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicDto,
  ): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsSvc.update(id, dto, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(clinic, 'Clinic updated');
  }

  @Delete('clinics/:id')
  @ApiOperation({ summary: 'Soft-delete a clinic (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deleteClinic(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<null>> {
    await this.clinicsSvc.remove(id, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(null, 'Clinic deleted');
  }

  @Patch('clinics/:id/verify')
  @ApiOperation({ summary: 'Verify / approve a clinic (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async verifyClinic(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsSvc.verify(id, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(clinic, 'Clinic approved');
  }

  @Patch('clinics/:id/suspend')
  @ApiOperation({ summary: 'Suspend a clinic (disable without deleting) (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async suspendClinic(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsSvc.suspend(id, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(clinic, 'Clinic suspended');
  }

  @Patch('clinics/:id/activate')
  @ApiOperation({ summary: 'Re-activate a suspended clinic (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async activateClinic(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsSvc.activate(id, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(clinic, 'Clinic activated');
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

  // ─── Shop List + Detail ───────────────────────────────────────────────────

  @Get('shops')
  @ApiOperation({ summary: 'List shops with filters (admin)' })
  async allShops(@Query() query: AdminShopQueryDto, @Query('isVerified') isVerifiedRaw?: string, @Query('isActive') isActiveRaw?: string): Promise<ApiResponseDto<object>> {
    const isVerified = isVerifiedRaw === 'false' ? false : isVerifiedRaw === 'true' ? true : true;
    const isActiveParsed = isActiveRaw === 'false' ? false : isActiveRaw === 'true' ? true : undefined;
    const shops = await this.shopRepo.findMany({
      search: query.search,
      city: query.city,
      isVerified,
      // When fetching unverified (verification queue), don't restrict by isActive
      ...(isActiveParsed !== undefined
        ? { isActive: isActiveParsed }
        : isVerified ? { isActive: true } : {}),
      page:  query.page  ?? 1,
      limit: query.limit ?? 20,
    });
    return ApiResponseDto.success(shops);
  }

  @Get('shops/:id')
  @ApiOperation({ summary: 'Get shop detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getShop(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const shop = await this.shopRepo.findById(id);
    if (!shop) throw new NotFoundException('Shop not found');
    return ApiResponseDto.success(shop);
  }

  @Patch('shops/:id')
  @ApiOperation({ summary: 'Update shop details (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateShop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShopDto,
  ): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsSvc.update(id, dto, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(shop, 'Shop updated');
  }

  @Delete('shops/:id')
  @ApiOperation({ summary: 'Soft-delete a shop (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deleteShop(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<null>> {
    await this.shopsSvc.remove(id, UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(null, 'Shop deleted');
  }

  @Patch('shops/:id/verify')
  @ApiOperation({ summary: 'Verify / approve a shop (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async verifyShop(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsSvc.verify(id, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(shop, 'Shop verified');
  }

  @Patch('shops/:id/suspend')
  @ApiOperation({ summary: 'Suspend a shop (disable without deleting) (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async suspendShop(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsSvc.suspend(id, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(shop, 'Shop suspended');
  }

  @Patch('shops/:id/activate')
  @ApiOperation({ summary: 'Re-activate a suspended shop (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async activateShop(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsSvc.activate(id, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(shop, 'Shop activated');
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

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user profile fields (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<ApiResponseDto<object>> {
    const user = await this.adminUserSvc.updateUser(id, dto);
    return ApiResponseDto.success(user, 'User updated');
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

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Reset user password — generates a temporary password, forces change on next login (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async resetUserPassword(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.resetUserPassword(id);
    return ApiResponseDto.success(result, 'Password reset. Share the temporary password with the user.');
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

  @Get('delivery-partners/:id')
  @ApiOperation({ summary: 'Get delivery partner detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getDeliveryPartner(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const partner = await this.deliveryPartnerRepo.findById(id);
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return ApiResponseDto.success(partner);
  }

  // ─── Pets Overview ────────────────────────────────────────────────────────

  @Get('pets')
  @ApiOperation({ summary: 'List all pets across all owners (admin)' })
  async allPets(@Query() query: AdminPetQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.listPets(query);
    return ApiResponseDto.success(result);
  }

  @Get('pets/:id')
  @ApiOperation({ summary: 'Get pet detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getPet(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const pet = await this.adminUserSvc.getPet(id);
    if (!pet) throw new NotFoundException('Pet not found');
    return ApiResponseDto.success(pet);
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

  @Get('revenue/by-clinic')
  @ApiOperation({ summary: 'Revenue breakdown by clinic (admin)' })
  async revenueByClinic(@Query() query: RevenueQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.revenueByClinic(query);
    return ApiResponseDto.success(result);
  }

  @Get('revenue/by-shop')
  @ApiOperation({ summary: 'Revenue breakdown by shop (admin)' })
  async revenueByShop(@Query() query: RevenueQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.adminUserSvc.revenueByShop(query);
    return ApiResponseDto.success(result);
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

  @Delete('notifications/:id')
  @ApiOperation({ summary: 'Delete a specific notification (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deleteNotification(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    await this.notificationRepo.deleteAdmin(id);
    return ApiResponseDto.success({ deleted: true }, 'Notification deleted');
  }

  // ─── Complaints ───────────────────────────────────────────────────────────

  @Get('complaints')
  @ApiOperation({ summary: 'List all complaints (admin)' })
  async allComplaints(@Query() query: ComplaintQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.complaintsSvc.findAll(query, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(result);
  }

  @Get('complaints/:id')
  @ApiOperation({ summary: 'Get complaint detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getComplaint(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const complaint = await this.complaintsSvc.findOne(id, '', UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(complaint);
  }

  @Patch('complaints/:id')
  @ApiOperation({ summary: 'Update complaint status / add admin notes (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateComplaint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplaintStatusDto,
  ): Promise<ApiResponseDto<object>> {
    const complaint = await this.complaintsSvc.updateStatus(id, dto);
    return ApiResponseDto.success(complaint, 'Complaint updated');
  }

  @Patch('complaints/:id/priority')
  @ApiOperation({ summary: 'Set complaint priority (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async setComplaintPriority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplaintPriorityDto,
  ): Promise<ApiResponseDto<object>> {
    const complaint = await this.complaintsSvc.updatePriority(id, dto.priority);
    return ApiResponseDto.success(complaint, 'Complaint priority updated');
  }

  // ─── Appointments ─────────────────────────────────────────────────────────

  @Get('appointments')
  @ApiOperation({ summary: 'List all appointments across all clinics (admin)' })
  async allAppointments(@Query() query: AppointmentQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.appointmentRepo.findMany({}, query);
    return ApiResponseDto.success(result);
  }

  @Get('appointments/:id')
  @ApiOperation({ summary: 'Get appointment detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getAppointment(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentRepo.findById(id);
    if (!appt) throw new NotFoundException('Appointment not found');
    return ApiResponseDto.success(appt);
  }

  // ─── Reviews Moderation ───────────────────────────────────────────────────

  @Get('reviews')
  @ApiOperation({ summary: 'List all reviews across all clinics/shops (admin)' })
  async allReviews(@Query() query: ReviewQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.reviewsSvc.findMany(query);
    return ApiResponseDto.success(result);
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Delete a review (admin moderation)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deleteReview(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<null>> {
    await this.reviewsSvc.remove(id, id, UserRole.SUPER_ADMIN);
    return ApiResponseDto.success(null, 'Review deleted');
  }

  // ─── Doctor Detail ────────────────────────────────────────────────────────

  @Get('doctors/:id')
  @ApiOperation({ summary: 'Get doctor detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getDoctor(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const doctor = await this.doctorRepo.findById(id);
    if (!doctor) throw new NotFoundException('Doctor not found');
    return ApiResponseDto.success(doctor);
  }

  // ─── Appointment Cancel ───────────────────────────────────────────────────

  @Patch('appointments/:id/cancel')
  @ApiOperation({ summary: 'Cancel an appointment (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async cancelAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentRepo.findRaw(id);
    if (!appt) throw new NotFoundException('Appointment not found');
    const terminal: string[] = ['CANCELLED', 'COMPLETED', 'NO_SHOW'];
    if (terminal.includes(appt.status)) {
      throw new NotFoundException(`Cannot cancel appointment with status ${appt.status}`);
    }
    const updated = await this.appointmentRepo.update(id, {
      status: AppointmentStatus.CANCELLED,
      cancellationReason: dto.reason,
      updatedBy: 'admin',
    });
    return ApiResponseDto.success(updated, 'Appointment cancelled');
  }

  // ─── Order Status Override ────────────────────────────────────────────────

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Override order status (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminOrderStatusDto,
  ): Promise<ApiResponseDto<object>> {
    const order = await this.orderRepo.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    const updated = await this.orderRepo.updateStatus(id, dto.status, { updatedBy: 'admin' });
    return ApiResponseDto.success(updated, 'Order status updated');
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  @Get('products')
  @ApiOperation({ summary: 'List all products across all shops (admin)' })
  async allProducts(@Query() query: ProductQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.productsSvc.findMany(query);
    return ApiResponseDto.success(result);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getProduct(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const product = await this.productsSvc.findOne(id);
    return ApiResponseDto.success(product);
  }

  // ─── Verification Documents ───────────────────────────────────────────────

  @Get('verification-docs/clinic/:clinicId')
  @ApiOperation({ summary: 'Get all verification documents submitted by a clinic (admin)' })
  @ApiParam({ name: 'clinicId', type: 'string', format: 'uuid' })
  async getClinicDocs(@Param('clinicId', ParseUUIDPipe) clinicId: string): Promise<ApiResponseDto<object>> {
    const docs = await this.verificationDocsSvc.getDocsForClinicAdmin(clinicId);
    return ApiResponseDto.success(docs);
  }

  @Get('verification-docs/shop/:shopId')
  @ApiOperation({ summary: 'Get all verification documents submitted by a shop (admin)' })
  @ApiParam({ name: 'shopId', type: 'string', format: 'uuid' })
  async getShopDocs(@Param('shopId', ParseUUIDPipe) shopId: string): Promise<ApiResponseDto<object>> {
    const docs = await this.verificationDocsSvc.getDocsForShopAdmin(shopId);
    return ApiResponseDto.success(docs);
  }

  @Patch('verification-docs/:id/review')
  @ApiOperation({ summary: 'Approve or reject a specific verification document (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async reviewDoc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDocDto,
  ): Promise<ApiResponseDto<object>> {
    const doc = await this.verificationDocsSvc.reviewDoc(id, dto, 'admin');
    return ApiResponseDto.success(doc, `Document ${dto.action}d`);
  }

  // ─── Service Bookings ─────────────────────────────────────────────────────

  @Get('service-bookings')
  @ApiOperation({ summary: 'List all service bookings across all clinics (admin)' })
  async allServiceBookings(@Query() query: BookingQueryDto & { clinicId?: string }): Promise<ApiResponseDto<object>> {
    const result = await this.bookingRepo.findAll(query);
    return ApiResponseDto.success(result);
  }

  @Get('service-bookings/:id')
  @ApiOperation({ summary: 'Get service booking detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getServiceBooking(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Service booking not found');
    return ApiResponseDto.success(booking);
  }

  @Patch('service-bookings/:id/status')
  @ApiOperation({ summary: 'Override service booking status — cancel or complete (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateServiceBookingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ServiceBookingStatus,
  ): Promise<ApiResponseDto<object>> {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Service booking not found');
    const updated = await this.bookingRepo.updateStatus(id, { status });
    return ApiResponseDto.success(updated, 'Booking status updated');
  }

  // ─── Pet Services (admin) ─────────────────────────────────────────────────

  @Get('services')
  @ApiOperation({ summary: 'List all pet services across all clinics (admin)' })
  async allServices(@Query() query: ServiceQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.serviceRepo.findAllAdmin(query);
    return ApiResponseDto.success(result);
  }

  @Get('services/:id')
  @ApiOperation({ summary: 'Get pet service detail (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getService(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const service = await this.serviceRepo.findById(id);
    if (!service) throw new NotFoundException('Service not found');
    return ApiResponseDto.success(service);
  }

  @Post('services')
  @ApiOperation({ summary: 'Create a pet service for a clinic (admin)' })
  async createService(@Body() dto: AdminCreateServiceDto): Promise<ApiResponseDto<object>> {
    const service = await this.serviceRepo.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      price: dto.basePrice ?? dto.price,
      duration: dto.duration,
      maxPetsPerSlot: dto.maxPetsPerSlot ?? 1,
      clinic: { connect: { id: dto.clinicId } },
      createdBy: 'admin',
    });
    return ApiResponseDto.success(service, 'Service created');
  }

  @Patch('services/:id')
  @ApiOperation({ summary: 'Update a pet service (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateServiceDto,
  ): Promise<ApiResponseDto<object>> {
    const service = await this.serviceRepo.findById(id);
    if (!service) throw new NotFoundException('Service not found');
    const updated = await this.serviceRepo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...((dto.price !== undefined || dto.basePrice !== undefined) && { price: dto.basePrice ?? dto.price }),
      ...(dto.duration !== undefined && { duration: dto.duration }),
      ...(dto.maxPetsPerSlot !== undefined && { maxPetsPerSlot: dto.maxPetsPerSlot }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return ApiResponseDto.success(updated, 'Service updated');
  }

  @Delete('services/:id')
  @ApiOperation({ summary: 'Soft-delete a pet service (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deleteService(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<null>> {
    const service = await this.serviceRepo.findById(id);
    if (!service) throw new NotFoundException('Service not found');
    await this.serviceRepo.softDelete(id);
    return ApiResponseDto.success(null, 'Service deleted');
  }
}
