import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { AssignComplaintDto, UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';

@ApiTags('Complaints')
@ApiBearerAuth('access-token')
@Controller({ path: 'complaints', version: '1' })
export class ComplaintsController {
  constructor(private readonly svc: ComplaintsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a complaint' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateComplaintDto,
  ): Promise<ApiResponseDto<object>> {
    const complaint = await this.svc.create(dto, user.sub);
    return ApiResponseDto.success(complaint, 'Complaint submitted');
  }

  @Get()
  @ApiOperation({ summary: 'List complaints (admin sees all, user sees own)' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ComplaintQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.findAll(query, user.sub, user.role);
    return ApiResponseDto.success(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complaint detail' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const complaint = await this.svc.findOne(id, user.sub, user.role);
    return ApiResponseDto.success(complaint);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update complaint status (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplaintStatusDto,
  ): Promise<ApiResponseDto<object>> {
    const complaint = await this.svc.updateStatus(id, dto);
    return ApiResponseDto.success(complaint, 'Status updated');
  }

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign complaint to admin (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignComplaintDto,
  ): Promise<ApiResponseDto<object>> {
    const complaint = await this.svc.assign(id, dto);
    return ApiResponseDto.success(complaint, 'Complaint assigned');
  }
}
