import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferenceDto {
  @IsBoolean() @IsOptional() bookingNotifications?: boolean;
  @IsBoolean() @IsOptional() orderNotifications?: boolean;
  @IsBoolean() @IsOptional() reviewNotifications?: boolean;
  @IsBoolean() @IsOptional() vaccinationReminders?: boolean;
  @IsBoolean() @IsOptional() marketingNotifications?: boolean;
  @IsBoolean() @IsOptional() systemNotifications?: boolean;
  @IsBoolean() @IsOptional() deliveryNotifications?: boolean;
}
