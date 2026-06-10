import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentQueryDto,
  AvailableSlotsQueryDto,
  CancelAppointmentDto,
  CreateAppointmentDto,
  RescheduleAppointmentDto,
  UpdateAppointmentStatusDto,
} from './dto';

// ─── Appointment routes (/api/v1/appointments) ─────────────────────────────────

@ApiTags('Appointments')
@ApiBearerAuth('access-token')
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // POST /appointments
  @Post()
  @Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Book an appointment (pet owner or admin)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAppointmentDto,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.create(dto, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Appointment booked successfully');
  }

  // GET /appointments/my
  @Get('my')
  @ApiOperation({ summary: 'Get my appointments (pet owner)' })
  async getMyAppointments(
    @CurrentUser() user: JwtPayload,
    @Query() query: AppointmentQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.appointmentsService.findMyAppointments(user.sub, query);
    return ApiResponseDto.success(data);
  }

  // GET /appointments/history
  @Get('history')
  @ApiOperation({ summary: 'Get completed/cancelled/no-show appointment history (pet owner)' })
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: AppointmentQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.appointmentsService.findHistory(user.sub, query);
    return ApiResponseDto.success(data);
  }

  // GET /appointments/stats/admin
  @Get('stats/admin')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform-wide appointment statistics (admin)' })
  async adminStats(): Promise<ApiResponseDto<object>> {
    const stats = await this.appointmentsService.getAdminStats();
    return ApiResponseDto.success(stats);
  }

  // GET /appointments/stats/doctor
  @Get('stats/doctor')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Doctor appointment statistics' })
  async doctorStats(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const stats = await this.appointmentsService.getDoctorStats(user.sub);
    return ApiResponseDto.success(stats);
  }

  // GET /appointments/stats/clinic/:clinicId
  @Get('stats/clinic/:clinicId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Clinic appointment statistics (admin or clinic owner)' })
  @ApiParam({ name: 'clinicId', type: 'string', format: 'uuid' })
  async clinicStats(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
  ): Promise<ApiResponseDto<object>> {
    const stats = await this.appointmentsService.getClinicStats(clinicId);
    return ApiResponseDto.success(stats);
  }

  // GET /appointments (admin list with full filters)
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all appointments with filters (admin)' })
  async findAll(@Query() query: AppointmentQueryDto): Promise<ApiResponseDto<object>> {
    const data = await this.appointmentsService.findAll(query);
    return ApiResponseDto.success(data);
  }

  // GET /appointments/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get appointment details (owner, assigned doctor, or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.findOne(id, user.sub, user.role);
    return ApiResponseDto.success(appt);
  }

  // PATCH /appointments/:id/status
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update appointment status (doctor or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAppointmentStatusDto,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.updateStatus(id, dto, user.sub, user.role);
    return ApiResponseDto.success(appt, `Status updated to ${dto.status}`);
  }

  // PATCH /appointments/:id/reschedule
  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule an appointment (owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RescheduleAppointmentDto,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.reschedule(id, dto, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Appointment rescheduled');
  }

  // PATCH /appointments/:id/cancel
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an appointment (owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CancelAppointmentDto,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.cancel(id, dto, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Appointment cancelled');
  }
}

// ─── Clinic appointment routes (/api/v1/clinics/:clinicId/appointments) ────────

@ApiTags('Appointments')
@ApiBearerAuth('access-token')
@Controller({ path: 'clinics', version: '1' })
export class ClinicAppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // GET /clinics/:clinicId/appointments
  @Get(':clinicId/appointments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'List appointments for a specific clinic' })
  @ApiParam({ name: 'clinicId', type: 'string', format: 'uuid' })
  async findByClinic(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() query: AppointmentQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.appointmentsService.findByClinic(clinicId, query);
    return ApiResponseDto.success(data);
  }
}

// ─── Doctor appointment routes (/api/v1/doctors) ──────────────────────────────

@ApiTags('Appointments')
@Controller({ path: 'doctors', version: '1' })
export class DoctorAppointmentController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // GET /doctors/me/appointments
  @Get('me/appointments')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Get the authenticated doctor's appointments" })
  async getMyAppointments(
    @CurrentUser() user: JwtPayload,
    @Query() query: AppointmentQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.appointmentsService.findByDoctorUserId(user.sub, query);
    return ApiResponseDto.success(data);
  }

  // GET /doctors/:doctorId/available-slots
  @Public()
  @Get(':doctorId/available-slots')
  @ApiOperation({ summary: 'Get available booking slots for a doctor on a given date' })
  @ApiParam({ name: 'doctorId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'date', required: true, example: '2026-06-15' })
  @ApiQuery({ name: 'slotDuration', required: false, example: 30 })
  async getAvailableSlots(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() query: AvailableSlotsQueryDto,
  ): Promise<ApiResponseDto<string[]>> {
    const slots = await this.appointmentsService.getAvailableSlots(doctorId, query);
    return ApiResponseDto.success(slots);
  }
}
