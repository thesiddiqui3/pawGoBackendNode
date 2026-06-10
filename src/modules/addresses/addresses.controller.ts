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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreateAddressDto, UpdateAddressDto } from './dto';
import { AddressesService } from './addresses.service';

@ApiTags('Addresses')
@ApiBearerAuth('access-token')
@Roles(UserRole.PET_OWNER, UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
@Controller({ path: 'addresses', version: '1' })
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new delivery address' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAddressDto,
  ): Promise<ApiResponseDto<object>> {
    const address = await this.addressesService.create(user.sub, dto);
    return ApiResponseDto.success(address, 'Address created');
  }

  @Get()
  @ApiOperation({ summary: 'List all addresses for the current user' })
  async findAll(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const addresses = await this.addressesService.findAll(user.sub);
    return ApiResponseDto.success(addresses);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an address' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAddressDto,
  ): Promise<ApiResponseDto<object>> {
    const address = await this.addressesService.update(id, dto, user.sub);
    return ApiResponseDto.success(address, 'Address updated');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an address' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.addressesService.remove(id, user.sub);
    return ApiResponseDto.success(null, 'Address deleted');
  }

  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set an address as default' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const address = await this.addressesService.setDefault(id, user.sub);
    return ApiResponseDto.success(address, 'Default address updated');
  }
}
