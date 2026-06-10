import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClinicsModule } from '../clinics/clinics.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { PetsModule } from '../pets/pets.module';
import { AppointmentRepository } from './appointment.repository';
import {
  AppointmentsController,
  ClinicAppointmentsController,
  DoctorAppointmentController,
} from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [PetsModule, ClinicsModule, DoctorsModule, EventEmitterModule.forRoot()],
  controllers: [
    AppointmentsController,
    ClinicAppointmentsController,
    DoctorAppointmentController,
  ],
  providers: [AppointmentsService, AppointmentRepository],
  exports: [AppointmentsService, AppointmentRepository],
})
export class AppointmentsModule {}
