import { IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  deliveryPartnerId: string;
}
