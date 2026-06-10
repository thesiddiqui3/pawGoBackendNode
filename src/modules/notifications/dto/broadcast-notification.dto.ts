import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../../common/enums';

export enum BroadcastTarget {
  ALL_USERS = 'ALL_USERS',
  PET_OWNERS = 'PET_OWNERS',
  DOCTORS = 'DOCTORS',
  SHOP_OWNERS = 'SHOP_OWNERS',
  DELIVERY_PARTNERS = 'DELIVERY_PARTNERS',
}

export class BroadcastNotificationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(BroadcastTarget)
  target: BroadcastTarget;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
