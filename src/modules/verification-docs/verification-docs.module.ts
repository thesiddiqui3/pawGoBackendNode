import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../shared/cloudinary/cloudinary.module';
import {
  AdminDocsController,
  ClinicDocsController,
  DeliveryPartnerDocsController,
  DoctorDocsController,
  ShopDocsController,
} from './verification-docs.controller';
import { VerificationDocsRepository } from './verification-docs.repository';
import { VerificationDocsService } from './verification-docs.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [ClinicDocsController, ShopDocsController, DoctorDocsController, DeliveryPartnerDocsController, AdminDocsController],
  providers: [VerificationDocsRepository, VerificationDocsService],
  exports: [VerificationDocsService],
})
export class VerificationDocsModule {}
