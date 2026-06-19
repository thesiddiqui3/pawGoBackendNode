import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { ClinicReportsService } from './clinic-reports.service';

@ApiTags('Clinic Reports')
@ApiBearerAuth('access-token')
@Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
@Controller({ version: '1' })
export class ClinicReportsController {
  constructor(private readonly reportsService: ClinicReportsService) {}

  @Get('clinic/reports/appointments')
  @ApiOperation({ summary: 'Appointment report with date range filter' })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-12-31' })
  @ApiQuery({ name: 'clinicId', required: false })
  async appointmentReport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.reportsService.appointmentReport(user.sub, user.role, from, to, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/reports/revenue')
  @ApiOperation({ summary: 'Revenue report with date range filter' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'clinicId', required: false })
  async revenueReport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.reportsService.revenueReport(user.sub, user.role, from, to, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/reports/vaccinations')
  @ApiOperation({ summary: 'Vaccination report with date range filter' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'clinicId', required: false })
  async vaccinationReport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.reportsService.vaccinationReport(user.sub, user.role, from, to, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/reports/doctor-performance')
  @ApiOperation({ summary: 'Doctor performance report' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'clinicId', required: false })
  async doctorPerformanceReport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.reportsService.doctorPerformanceReport(user.sub, user.role, from, to, clinicId);
    return ApiResponseDto.success(data);
  }
}
