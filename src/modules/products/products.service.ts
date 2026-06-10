import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Product } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { ShopRepository } from '../shops/shop.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductRepository } from './product.repository';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productRepository: ProductRepository,
    private readonly shopRepository: ShopRepository,
  ) {}

  async create(dto: CreateProductDto, shopId: string, requesterId: string, role: string): Promise<object> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop || shop.deletedAt) throw new NotFoundException('Shop not found');
    this.assertShopOwnerOrAdmin(shop.ownerId, requesterId, role);

    const product = await this.productRepository.create(shopId, dto, requesterId);
    this.logger.log(`Product created: ${product.id} in shop ${shopId}`);
    return product;
  }

  async findMany(query: ProductQueryDto): Promise<PaginatedResponseDto<object>> {
    return this.productRepository.findMany(query);
  }

  async findOne(id: string): Promise<object> {
    const product = await this.productRepository.findById(id);
    if (!product || product.deletedAt) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto, requesterId: string, role: string): Promise<object> {
    const product = await this.productRepository.findById(id);
    if (!product || product.deletedAt) throw new NotFoundException('Product not found');

    const shop = await this.shopRepository.findById(product.shopId);
    if (!shop) throw new NotFoundException('Shop not found');
    this.assertShopOwnerOrAdmin(shop.ownerId, requesterId, role);

    return this.productRepository.update(id, dto);
  }

  async remove(id: string, requesterId: string, role: string): Promise<void> {
    const product = await this.productRepository.findById(id);
    if (!product || product.deletedAt) throw new NotFoundException('Product not found');

    const shop = await this.shopRepository.findById(product.shopId);
    if (!shop) throw new NotFoundException('Shop not found');
    this.assertShopOwnerOrAdmin(shop.ownerId, requesterId, role);

    await this.productRepository.softDelete(id);
    this.logger.log(`Product deleted: ${id}`);
  }

  async findByIdOrThrow(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product || product.deletedAt || !product.isActive) {
      throw new NotFoundException('Product not found or inactive');
    }
    return product as unknown as Product;
  }

  private assertShopOwnerOrAdmin(shopOwnerId: string, requesterId: string, role: string): void {
    if (role === UserRole.SUPER_ADMIN) return;
    if (shopOwnerId === requesterId) return;
    throw new ForbiddenException('You do not have permission to manage products in this shop');
  }
}
