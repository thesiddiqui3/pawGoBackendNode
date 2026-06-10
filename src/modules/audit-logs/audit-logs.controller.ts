import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditLogsService } from './audit-logs.service';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateAuditLogDto {
  @ApiProperty({ enum: AuditAction })
  @IsEnum(AuditAction)
  action!: AuditAction;

  @ApiProperty()
  @IsString()
  entity!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@Roles(UserRole.SUPER_ADMIN)
@Controller({ path: 'admin/audit-logs', version: '1' })
export class AuditLogsController {
  constructor(private readonly svc: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs (admin)' })
  async findAll(@Query() query: AuditLogQueryDto): Promise<ApiResponseDto<object>> {
    const result = await this.svc.findAll(query);
    return ApiResponseDto.success(result);
  }

  @Post()
  @ApiOperation({ summary: 'Create audit log entry (admin)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAuditLogDto,
  ): Promise<ApiResponseDto<object>> {
    const log = await this.svc.log({
      userId: user.sub,
      action: dto.action,
      entity: dto.entity,
      entityId: dto.entityId,
      metadata: dto.metadata,
    });
    return ApiResponseDto.success(log as unknown as object, 'Log created');
  }
}
