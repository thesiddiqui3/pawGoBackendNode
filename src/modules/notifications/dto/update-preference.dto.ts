import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferenceDto {
  @IsBoolean() @IsOptional() bookingNotifications?: boolean;
  @IsBoolean() @IsOptional() cancellationNotifications?: boolean;
  @IsBoolean() @IsOptional() orderNotifications?: boolean;
  @IsBoolean() @IsOptional() reviewNotifications?: boolean;
  @IsBoolean() @IsOptional() assistantNotifications?: boolean;
  @IsBoolean() @IsOptional() vaccinationReminders?: boolean;
  @IsBoolean() @IsOptional() marketingNotifications?: boolean;
  @IsBoolean() @IsOptional() systemNotifications?: boolean;
  @IsBoolean() @IsOptional() deliveryNotifications?: boolean;
  @IsBoolean() @IsOptional() dailySummaryEmail?: boolean;
  @IsBoolean() @IsOptional() weeklySummaryEmail?: boolean;
}
