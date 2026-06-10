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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a product in a shop' })
  async create(
    @Query('shopId', ParseUUIDPipe) shopId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProductDto,
  ): Promise<ApiResponseDto<object>> {
    const product = await this.productsService.create(dto, shopId, user.sub, user.role);
    return ApiResponseDto.success(product, 'Product created');
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List and search products (public)' })
  async findMany(@Query() query: ProductQueryDto): Promise<ApiResponseDto<object>> {
    const data = await this.productsService.findMany(query);
    return ApiResponseDto.success(data);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get product detail (public)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const product = await this.productsService.findOne(id);
    return ApiResponseDto.success(product);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a product (shop owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProductDto,
  ): Promise<ApiResponseDto<object>> {
    const product = await this.productsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(product, 'Product updated');
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SHOP_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a product (shop owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.productsService.remove(id, user.sub, user.role);
    return ApiResponseDto.success(null, 'Product deleted');
  }
}
