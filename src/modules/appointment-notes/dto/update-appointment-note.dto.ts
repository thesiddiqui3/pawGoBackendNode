import { PartialType } from '@nestjs/swagger';
import { CreateAppointmentNoteDto } from './create-appointment-note.dto';

export class UpdateAppointmentNoteDto extends PartialType(CreateAppointmentNoteDto) {}
