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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreateAppointmentNoteDto, UpdateAppointmentNoteDto } from './dto';
import { AppointmentNotesService } from './appointment-notes.service';

@ApiTags('Appointment Notes')
@ApiBearerAuth('access-token')
@Controller({ path: 'appointments', version: '1' })
export class AppointmentNotesController {
  constructor(private readonly notesService: AppointmentNotesService) {}

  // POST /appointments/:id/notes
  @Post(':id/notes')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add clinical notes to an appointment (doctor or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Appointment ID' })
  async create(
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @Body() dto: CreateAppointmentNoteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const note = await this.notesService.create(appointmentId, dto, user.sub, user.role);
    return ApiResponseDto.success(note, 'Appointment note created');
  }

  // GET /appointments/:id/notes
  @Get(':id/notes')
  @Roles(
    UserRole.ASSISTANT,
    UserRole.CLINIC_OWNER,
    UserRole.PET_OWNER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Get clinical notes for an appointment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Appointment ID' })
  async findByAppointment(
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object | null>> {
    const note = await this.notesService.findByAppointment(appointmentId, user.sub, user.role);
    return ApiResponseDto.success(note);
  }
}

// ─── Standalone notes controller for PATCH /notes/:id ─────────────────────

@ApiTags('Appointment Notes')
@ApiBearerAuth('access-token')
@Controller({ path: 'notes', version: '1' })
export class AppointmentNoteUpdateController {
  constructor(private readonly notesService: AppointmentNotesService) {}

  @Patch(':id')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update appointment note (doctor or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Note ID' })
  async update(
    @Param('id', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateAppointmentNoteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const note = await this.notesService.update(noteId, dto, user.sub, user.role);
    return ApiResponseDto.success(note, 'Appointment note updated');
  }
}
