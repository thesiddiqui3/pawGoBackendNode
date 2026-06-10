import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  // Legacy single-target format
  @IsOptional()
  @IsEnum(BroadcastTarget)
  target?: BroadcastTarget;

  // Frontend multi-role format: ["PET_OWNER", "CLINIC_OWNER", ...]
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  type?: string;
}
