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
import { AppointmentStatus } from '../../common/enums/appointment.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentQueryDto,
  AvailableSlotsQueryDto,
  CancelAppointmentDto,
  CreateAppointmentDto,
  RescheduleAppointmentDto,
  UpdateAppointmentStatusDto,
  WalkInAppointmentDto,
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

  // POST /appointments/walk-in
  @Post('walk-in')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create walk-in appointment (reception/clinic staff)' })
  async createWalkIn(
    @CurrentUser() user: JwtPayload,
    @Body() dto: WalkInAppointmentDto,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.createWalkIn(dto, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Walk-in appointment created');
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

  // GET /appointments/clinic — clinic staff list their own clinic's appointments
  @Get('clinic')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List appointments for my clinic (auto-resolved from auth token)' })
  async findMyClinicAppointments(
    @CurrentUser() user: JwtPayload,
    @Query() query: AppointmentQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.appointmentsService.findMyClinicAppointments(user.sub, user.role, query);
    return ApiResponseDto.success(data);
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
  @ApiOperation({ summary: 'Get appointment details (owner, assigned doctor, clinic staff, or admin)' })
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
  @Roles(UserRole.ASSISTANT, UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update appointment status (doctor, clinic staff, pet owner cancel, or admin)' })
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
  @Roles(UserRole.PET_OWNER, UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reschedule an appointment (owner, clinic staff, or admin)' })
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
  @Roles(UserRole.PET_OWNER, UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel an appointment (owner, clinic staff, or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CancelAppointmentDto,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.cancel(id, dto, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Appointment cancelled');
  }

  // PATCH /appointments/:id/decline — assistant declines a pending booking
  @Patch(':id/decline')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ASSISTANT, UserRole.RECEPTIONIST, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Decline a pending appointment (assistant/staff) — notifies clinic owner to reassign' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async decline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.declineByStaff(id, user.sub);
    return ApiResponseDto.success(appt, 'Appointment declined');
  }

  // PATCH /appointments/:id/confirm — convenience alias
  @Patch(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Confirm an appointment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.updateStatus(id, { status: AppointmentStatus.CONFIRMED }, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Appointment confirmed');
  }

  // PATCH /appointments/:id/check-in — mark patient as checked in
  @Patch(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check in an appointment (patient arrived)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.updateStatus(id, { status: AppointmentStatus.CHECKED_IN }, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Patient checked in');
  }

  // PATCH /appointments/:id/start — mark as in-progress (from CHECKED_IN)
  @Patch(':id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Start an appointment (mark as in-progress)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.updateStatus(id, { status: AppointmentStatus.IN_PROGRESS }, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Appointment started');
  }

  // PATCH /appointments/:id/complete — convenience alias
  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark appointment as completed' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.updateStatus(id, { status: AppointmentStatus.COMPLETED }, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Appointment completed');
  }

  // PATCH /appointments/:id/no-show — convenience alias
  @Patch(':id/no-show')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark appointment as no-show' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async noShow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.updateStatus(id, { status: AppointmentStatus.NO_SHOW }, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Appointment marked as no-show');
  }

  // PATCH /appointments/:id/assign-doctor
  @Patch(':id/assign-doctor')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign a doctor to an appointment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async assignDoctor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { doctorId: string },
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.assignDoctor(id, body.doctorId, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Doctor assigned');
  }

  // PATCH /appointments/:id/assign-assistant
  @Patch(':id/notes')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add or update internal notes on an appointment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { notes: string },
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.updateNotes(id, body.notes, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Note saved');
  }

  @Patch(':id/assign-assistant')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign an assistant to an appointment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async assignAssistant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { assistantId: string },
  ): Promise<ApiResponseDto<object>> {
    const appt = await this.appointmentsService.assignAssistant(id, body.assistantId, user.sub, user.role);
    return ApiResponseDto.success(appt, 'Assistant assigned');
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST)
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
