import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { ClinicDashboardService } from './clinic-dashboard.service';

@ApiTags('Clinic Dashboard')
@ApiBearerAuth('access-token')
@Controller({ version: '1' })
export class ClinicDashboardController {
  constructor(private readonly dashboardService: ClinicDashboardService) {}

  @Get('clinic/dashboard/overview')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Clinic overview — doctors, appointments, reviews, services summary' })
  @ApiQuery({ name: 'clinicId', required: false, description: 'Admin use only' })
  async getOverview(
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.dashboardService.getOverview(user.sub, user.role, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/dashboard/revenue')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revenue breakdown for a period (today/week/month/year)' })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'year'] })
  @ApiQuery({ name: 'clinicId', required: false })
  async getRevenue(
    @CurrentUser() user: JwtPayload,
    @Query('period') period: 'today' | 'week' | 'month' | 'year',
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.dashboardService.getRevenue(user.sub, user.role, period ?? 'month', clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/dashboard/top-doctors')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Top 10 doctors by appointment count' })
  @ApiQuery({ name: 'clinicId', required: false })
  async getTopDoctors(
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.dashboardService.getTopDoctors(user.sub, user.role, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/dashboard/top-services')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Top 10 services by booking count' })
  @ApiQuery({ name: 'clinicId', required: false })
  async getTopServices(
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.dashboardService.getTopServices(user.sub, user.role, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/dashboard/appointment-stats')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Appointment stats by status and last 30 days trend' })
  @ApiQuery({ name: 'clinicId', required: false })
  async getAppointmentStats(
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.dashboardService.getAppointmentStats(user.sub, user.role, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/dashboard/recent-appointments')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Recent 10 appointments for the clinic' })
  @ApiQuery({ name: 'clinicId', required: false })
  async getRecentAppointments(
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.dashboardService.getRecentAppointments(user.sub, user.role, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/dashboard/upcoming-appointments')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upcoming 8 appointments for the clinic' })
  @ApiQuery({ name: 'clinicId', required: false })
  async getUpcomingAppointments(
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.dashboardService.getUpcomingAppointments(user.sub, user.role, clinicId);
    return ApiResponseDto.success(data);
  }
}
