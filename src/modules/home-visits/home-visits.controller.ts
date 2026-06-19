import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { AssignDoctorDto, CancelHomeVisitDto, CreateHomeVisitDto } from './dto/create-home-visit.dto';
import { HomeVisitsService } from './home-visits.service';

@ApiTags('Home Visits')
@ApiBearerAuth('access-token')
@Controller({ path: 'home-visits', version: '1' })
export class HomeVisitsController {
  constructor(private readonly homeVisitsService: HomeVisitsService) {}

  @Post()
  @Roles(UserRole.PET_OWNER)
  @ApiOperation({ summary: 'Request a home visit (pet owner)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateHomeVisitDto,
  ): Promise<ApiResponseDto<object>> {
    const visit = await this.homeVisitsService.create(dto, user.sub);
    return ApiResponseDto.success(visit, 'Home visit requested');
  }

  @Get('my')
  @Roles(UserRole.PET_OWNER)
  @ApiOperation({ summary: 'My home visit requests (pet owner)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMine(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.homeVisitsService.findMine(user.sub, +page, +limit);
    return ApiResponseDto.success(data);
  }

  @Get('clinic')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'All home visit requests for my clinic' })
  @ApiQuery({ name: 'status', required: false, enum: ['REQUESTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findForClinic(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.homeVisitsService.findForClinic(user.sub, user.role, status, +page, +limit);
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get home visit detail' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const visit = await this.homeVisitsService.findOne(id, user.sub, user.role);
    return ApiResponseDto.success(visit);
  }

  @Patch(':id/assign')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a doctor to the home visit (clinic staff)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async assignDoctor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AssignDoctorDto,
  ): Promise<ApiResponseDto<object>> {
    const visit = await this.homeVisitsService.assignDoctor(id, dto, user.sub, user.role);
    return ApiResponseDto.success(visit, 'Doctor assigned');
  }

  @Patch(':id/start')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark home visit as in-progress' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const visit = await this.homeVisitsService.start(id, user.sub, user.role);
    return ApiResponseDto.success(visit, 'Home visit started');
  }

  @Patch(':id/complete')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark home visit as completed' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const visit = await this.homeVisitsService.complete(id, user.sub, user.role);
    return ApiResponseDto.success(visit, 'Home visit completed');
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel home visit (owner or clinic staff)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CancelHomeVisitDto,
  ): Promise<ApiResponseDto<object>> {
    const visit = await this.homeVisitsService.cancel(id, dto, user.sub, user.role);
    return ApiResponseDto.success(visit, 'Home visit cancelled');
  }
}
