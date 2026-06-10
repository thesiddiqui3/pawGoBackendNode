import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import {
  BookingQueryDto,
  CreateBookingDto,
  CreateServiceDto,
  ServiceQueryDto,
  UpdateServiceDto,
} from './dto';
import { ServicesService } from './services.service';

// ─── Service Listings ─────────────────────────────────────────────────────────

@ApiTags('Services')
@Controller({ path: 'services', version: '1' })
export class ServicesController {
  constructor(private readonly svc: ServicesService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a service listing (clinic owner)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateServiceDto,
  ): Promise<ApiResponseDto<object>> {
    const service = await this.svc.createService(dto, user.sub);
    return ApiResponseDto.success(service, 'Service created');
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse active services (public)' })
  async findMany(@Query() query: ServiceQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.svc.listServices(query);
    return ApiResponseDto.success(result);
  }

  @Get('my')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'List my clinic services including inactive (clinic owner)' })
  async myServices(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const services = await this.svc.myClinicServices(user.sub);
    return ApiResponseDto.success(services);
  }

  @Public()
  @Get('clinic/:clinicId')
  @ApiOperation({ summary: 'List active services for a clinic (public)' })
  @ApiParam({ name: 'clinicId', type: 'string', format: 'uuid' })
  async findByClinic(@Param('clinicId', ParseUUIDPipe) clinicId: string): Promise<ApiResponseDto<object>> {
    const services = await this.svc.listClinicServices(clinicId);
    return ApiResponseDto.success(services);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get service detail (public)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const service = await this.svc.getService(id);
    return ApiResponseDto.success(service);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a service listing' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateServiceDto,
  ): Promise<ApiResponseDto<object>> {
    const service = await this.svc.updateService(id, dto, user.sub, user.role);
    return ApiResponseDto.success(service, 'Service updated');
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a service listing (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.deleteService(id, user.sub, user.role);
    return ApiResponseDto.success(result);
  }
}

// ─── Service Bookings ─────────────────────────────────────────────────────────

@ApiTags('Service Bookings')
@Controller({ path: 'service-bookings', version: '1' })
export class BookingsController {
  constructor(private readonly svc: ServicesService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(UserRole.PET_OWNER)
  @ApiOperation({ summary: 'Book a service' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBookingDto,
  ): Promise<ApiResponseDto<object>> {
    const booking = await this.svc.createBooking(dto, user.sub);
    return ApiResponseDto.success(booking, 'Booking created');
  }

  @Get('my')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.PET_OWNER)
  @ApiOperation({ summary: 'List my service bookings' })
  async myBookings(
    @CurrentUser() user: JwtPayload,
    @Query() query: BookingQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.myBookings(user.sub, query);
    return ApiResponseDto.success(result);
  }

  @Get('clinic')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List bookings for my clinic (clinic owner)' })
  async clinicBookings(
    @CurrentUser() user: JwtPayload,
    @Query() query: BookingQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.clinicBookings(user.sub, query);
    return ApiResponseDto.success(result);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get booking detail' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const booking = await this.svc.getBooking(id, user.sub, user.role);
    return ApiResponseDto.success(booking);
  }

  @Patch(':id/confirm')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Confirm a booking (clinic owner)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const booking = await this.svc.confirmBooking(id, user.sub, user.role);
    return ApiResponseDto.success(booking, 'Booking confirmed');
  }

  @Patch(':id/start')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark booking as in-progress (clinic owner)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const booking = await this.svc.startBooking(id, user.sub, user.role);
    return ApiResponseDto.success(booking, 'Service started');
  }

  @Patch(':id/complete')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Complete a booking (clinic owner)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const booking = await this.svc.completeBooking(id, user.sub, user.role);
    return ApiResponseDto.success(booking, 'Booking completed');
  }

  @Patch(':id/cancel')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel a booking (customer or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ): Promise<ApiResponseDto<object>> {
    const booking = await this.svc.cancelBooking(id, user.sub, user.role, reason);
    return ApiResponseDto.success(booking, 'Booking cancelled');
  }

  @Patch(':id/no-show')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark booking as no-show (clinic owner)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async noShow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const booking = await this.svc.markNoShow(id, user.sub, user.role);
    return ApiResponseDto.success(booking, 'Marked as no-show');
  }
}
