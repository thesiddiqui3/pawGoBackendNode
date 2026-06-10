import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import {
  CreateComplianceRuleDto,
  UpdateComplianceRuleDto,
} from './dto/compliance-rule.dto';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';
import {
  CreateSettingDto,
  SettingQueryDto,
  UpdateSettingDto,
} from './dto/setting.dto';
import { SystemSettingsService } from './system-settings.service';

@ApiTags('Admin / System Settings')
@ApiBearerAuth('access-token')
@Roles(UserRole.SUPER_ADMIN)
@Controller({ path: 'admin/settings', version: '1' })
export class SystemSettingsController {
  constructor(private readonly svc: SystemSettingsService) {}

  // ─── Key-Value Settings ───────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all system settings (optionally filtered by category)' })
  async getAll(@Query() query: SettingQueryDto): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getSettings(query.category));
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a single system setting by key' })
  @ApiParam({ name: 'key', type: 'string' })
  async getOne(@Param('key') key: string): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getSetting(key));
  }

  @Post()
  @ApiOperation({ summary: 'Create or upsert a system setting' })
  async create(
    @Body() dto: CreateSettingDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.createSetting(dto, user.sub), 'Setting saved');
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a system setting value' })
  @ApiParam({ name: 'key', type: 'string' })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.updateSetting(key, dto, user.sub), 'Setting updated');
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a system setting' })
  @ApiParam({ name: 'key', type: 'string' })
  async remove(@Param('key') key: string): Promise<ApiResponseDto<object>> {
    await this.svc.deleteSetting(key);
    return ApiResponseDto.success(null as unknown as object, 'Setting deleted');
  }

  // ─── Holidays ─────────────────────────────────────────────────────────────

  @Get('holidays/list')
  @ApiOperation({ summary: 'List all global holidays' })
  async getHolidays(): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getHolidays());
  }

  @Post('holidays')
  @ApiOperation({ summary: 'Create a global holiday' })
  async createHoliday(@Body() dto: CreateHolidayDto): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.createHoliday(dto), 'Holiday created');
  }

  @Patch('holidays/:id')
  @ApiOperation({ summary: 'Update a global holiday' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateHoliday(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.updateHoliday(id, dto), 'Holiday updated');
  }

  @Delete('holidays/:id')
  @ApiOperation({ summary: 'Delete a global holiday' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deleteHoliday(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    await this.svc.deleteHoliday(id);
    return ApiResponseDto.success(null as unknown as object, 'Holiday deleted');
  }

  // ─── Compliance Rules ──────────────────────────────────────────────────────

  @Get('compliance/list')
  @ApiOperation({ summary: 'List all active compliance rules' })
  async getRules(): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getRules());
  }

  @Post('compliance')
  @ApiOperation({ summary: 'Create a compliance rule' })
  async createRule(@Body() dto: CreateComplianceRuleDto): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.createRule(dto), 'Rule created');
  }

  @Patch('compliance/:id')
  @ApiOperation({ summary: 'Update a compliance rule' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplianceRuleDto,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.updateRule(id, dto), 'Rule updated');
  }

  @Delete('compliance/:id')
  @ApiOperation({ summary: 'Delete a compliance rule' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deleteRule(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    await this.svc.deleteRule(id);
    return ApiResponseDto.success(null as unknown as object, 'Rule deleted');
  }
}
