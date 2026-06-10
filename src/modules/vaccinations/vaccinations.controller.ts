import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateVaccinationDto, UpdateVaccinationDto, UpcomingVaccinationsQueryDto, VaccinationQueryDto } from './dto';
import { VaccinationsService } from './vaccinations.service';

const CERT_INTERCEPTOR = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

@ApiTags('Vaccinations')
@ApiBearerAuth('access-token')
@Controller({ path: 'vaccinations', version: '1' })
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  // POST /vaccinations
  @Post()
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record a vaccination (doctor or admin)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateVaccinationDto,
  ): Promise<ApiResponseDto<object>> {
    const v = await this.vaccinationsService.create(dto, user.sub, user.role);
    return ApiResponseDto.success(v, 'Vaccination recorded');
  }

  // GET /vaccinations/upcoming
  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming vaccinations within N days (default 30)' })
  async findUpcoming(
    @CurrentUser() user: JwtPayload,
    @Query() query: UpcomingVaccinationsQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.vaccinationsService.findUpcoming(query, user.sub, user.role);
    return ApiResponseDto.success(data);
  }

  // GET /vaccinations/reminders
  @Get('reminders')
  @ApiOperation({ summary: 'Get pending vaccination reminders (own or all for admin)' })
  async findReminders(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const data = await this.vaccinationsService.findReminders(user.sub, user.role);
    return ApiResponseDto.success(data);
  }

  // GET /vaccinations
  @Get()
  @ApiOperation({ summary: 'List vaccinations with filters' })
  async findMany(
    @CurrentUser() user: JwtPayload,
    @Query() query: VaccinationQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.vaccinationsService.findMany(query, user.sub, user.role);
    return ApiResponseDto.success(data);
  }

  // GET /vaccinations/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get vaccination detail' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const v = await this.vaccinationsService.findOne(id, user.sub, user.role);
    return ApiResponseDto.success(v);
  }

  // PATCH /vaccinations/:id
  @Patch(':id')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a vaccination record (doctor owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateVaccinationDto,
  ): Promise<ApiResponseDto<object>> {
    const v = await this.vaccinationsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(v, 'Vaccination updated');
  }

  // DELETE /vaccinations/:id
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a vaccination record (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.vaccinationsService.remove(id, user.sub, user.role);
    return ApiResponseDto.success(null, 'Vaccination deleted');
  }

  // POST /vaccinations/:id/certificate
  @Post(':id/certificate')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @UseInterceptors(CERT_INTERCEPTOR)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload vaccination certificate (PDF or image)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async uploadCertificate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    const v = await this.vaccinationsService.uploadCertificate(id, file, user.sub, user.role);
    return ApiResponseDto.success(v, 'Certificate uploaded');
  }
}

// ─── Pet-scoped vaccination timeline (/api/v1/pets/:petId/vaccinations) ────────

@ApiTags('Vaccinations')
@ApiBearerAuth('access-token')
@Controller({ path: 'pets', version: '1' })
export class PetVaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  @Get(':petId/vaccinations')
  @ApiOperation({ summary: 'Full vaccination timeline for a pet' })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  async findByPet(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.vaccinationsService.findByPet(petId, user.sub, user.role);
    return ApiResponseDto.success(data);
  }
}
