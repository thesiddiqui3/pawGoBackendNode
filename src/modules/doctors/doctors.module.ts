import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { UsersModule } from '../users/users.module';
import { DoctorRepository } from './doctor.repository';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';

@Module({
  imports: [UsersModule, ClinicsModule],
  controllers: [DoctorsController],
  providers: [DoctorsService, DoctorRepository],
  exports: [DoctorsService, DoctorRepository],
})
export class DoctorsModule {}
