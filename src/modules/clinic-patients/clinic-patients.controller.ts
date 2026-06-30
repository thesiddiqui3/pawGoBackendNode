import { Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { ClinicPatientsService } from './clinic-patients.service';

@ApiTags('Clinic Patients')
@ApiBearerAuth('access-token')
@Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
@Controller({ version: '1' })
export class ClinicPatientsController {
  constructor(private readonly service: ClinicPatientsService) {}

  @Get('clinic/patients')
  @ApiOperation({ summary: 'List all pets that visited this clinic' })
  @ApiQuery({ name: 'clinicId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listPatients(
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.service.listPatients(user.sub, user.role, clinicId, +page, +limit);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/patients/owners')
  @ApiOperation({ summary: 'List all pet owners who visited this clinic' })
  @ApiQuery({ name: 'clinicId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, description: 'Filter by owner name or phone' })
  async listOwners(
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.service.listOwners(user.sub, user.role, clinicId, +page, +limit, search);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/patients/:petId')
  @ApiOperation({ summary: 'Get pet profile at this clinic' })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'clinicId', required: false })
  async getPetProfile(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.service.getPetProfile(petId, user.sub, user.role, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/patients/:petId/visits')
  @ApiOperation({ summary: 'All appointments of a pet at this clinic' })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'clinicId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPetVisits(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.service.getPetVisits(petId, user.sub, user.role, clinicId, +page, +limit);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/patients/:petId/medical-history')
  @ApiOperation({ summary: 'Medical records of a pet at this clinic' })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'clinicId', required: false })
  async getMedicalHistory(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.service.getMedicalHistory(petId, user.sub, user.role, clinicId);
    return ApiResponseDto.success(data);
  }

  @Get('clinic/patients/:petId/vaccinations')
  @ApiOperation({ summary: 'Vaccination history of a pet at this clinic' })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'clinicId', required: false })
  async getVaccinationHistory(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: JwtPayload,
    @Query('clinicId') clinicId?: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.service.getVaccinationHistory(petId, user.sub, user.role, clinicId);
    return ApiResponseDto.success(data);
  }
}
