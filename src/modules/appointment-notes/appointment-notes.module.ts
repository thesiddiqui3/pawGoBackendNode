import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AppointmentNoteRepository } from './appointment-note.repository';
import {
  AppointmentNoteUpdateController,
  AppointmentNotesController,
} from './appointment-notes.controller';
import { AppointmentNotesService } from './appointment-notes.service';

@Module({
  imports: [AppointmentsModule],
  controllers: [AppointmentNotesController, AppointmentNoteUpdateController],
  providers: [AppointmentNotesService, AppointmentNoteRepository],
  exports: [AppointmentNotesService],
})
export class AppointmentNotesModule {}
