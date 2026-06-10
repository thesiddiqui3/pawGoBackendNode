import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateClinicDto } from './create-clinic.dto';

export class UpdateClinicDto extends PartialType(OmitType(CreateClinicDto, [] as const)) {}
