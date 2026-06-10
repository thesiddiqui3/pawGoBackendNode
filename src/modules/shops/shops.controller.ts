import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreateShopDto, UpdateShopDto } from './dto';
import { ShopsService } from './shops.service';

@ApiTags('Shops')
@Controller({ path: 'shops', version: '1' })
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a shop (shop owner gets one, admins can create multiple)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateShopDto,
  ): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.create(dto, user.sub, user.role);
    return ApiResponseDto.success(shop, 'Shop created');
  }

  @Get('my')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get the current shop owner\'s shop' })
  async findMyShop(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.findMyShop(user.sub);
    return ApiResponseDto.success(shop);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active shops (public)' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findMany(
    @Query('city') city?: string,
    @Query('search') search?: string,
  ): Promise<ApiResponseDto<object>> {
    const shops = await this.shopsService.findMany({ city, search });
    return ApiResponseDto.success(shops);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get shop by ID (public)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.findOne(id);
    return ApiResponseDto.success(shop);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update shop (owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShopDto,
  ): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(shop, 'Shop updated');
  }

  @Patch(':id/suspend')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspend a shop (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.suspend(id, user.sub, user.role);
    return ApiResponseDto.success(shop, 'Shop suspended');
  }

  @Patch(':id/activate')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate a shop (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const shop = await this.shopsService.activate(id, user.sub, user.role);
    return ApiResponseDto.success(shop, 'Shop activated');
  }
}
