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
import { AddToCartDto, UpdateCartItemDto } from './dto';
import { CartService } from './cart.service';

@ApiTags('Cart')
@ApiBearerAuth('access-token')
@Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
@Controller({ path: 'cart', version: '1' })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current cart with live prices and stock status' })
  async getCart(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const cart = await this.cartService.getCart(user.sub);
    return ApiResponseDto.success(cart);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a product to the cart (increments if already present)' })
  async addItem(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddToCartDto,
  ): Promise<ApiResponseDto<object>> {
    const cart = await this.cartService.addItem(user.sub, dto);
    return ApiResponseDto.success(cart, 'Item added to cart');
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Update item quantity in cart' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  async updateItem(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCartItemDto,
  ): Promise<ApiResponseDto<object>> {
    const cart = await this.cartService.updateItem(user.sub, productId, dto);
    return ApiResponseDto.success(cart, 'Cart updated');
  }

  @Delete('items/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an item from the cart' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  async removeItem(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const cart = await this.cartService.removeItem(user.sub, productId);
    return ApiResponseDto.success(cart, 'Item removed from cart');
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all items from cart' })
  async clearCart(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const cart = await this.cartService.clearCart(user.sub);
    return ApiResponseDto.success(cart, 'Cart cleared');
  }
}
