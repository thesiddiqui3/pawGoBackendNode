import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Shop } from '@prisma/client';
import { UserRole } from '../../common/enums';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { ShopRepository } from './shop.repository';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(dto: CreateShopDto, ownerId: string, role: string): Promise<Shop> {
    if (role === UserRole.SHOP_OWNER) {
      const exists = await this.shopRepository.existsByOwner(ownerId);
      if (exists) throw new ConflictException('You already have a shop registered');
    }
    const shop = await this.shopRepository.create(ownerId, dto, ownerId);
    this.logger.log(`Shop created: ${shop.id}`);
    return shop;
  }

  async findMany(filters: { city?: string; search?: string }) {
    return this.shopRepository.findMany({ ...filters, isActive: true });
  }

  async findOne(id: string): Promise<Shop> {
    const shop = await this.shopRepository.findById(id);
    if (!shop || shop.deletedAt) throw new NotFoundException('Shop not found');
    return shop;
  }

  async findMyShop(ownerId: string): Promise<Shop> {
    const shop = await this.shopRepository.findByOwner(ownerId);
    if (!shop || shop.deletedAt) throw new NotFoundException('You do not have a shop registered');
    return shop;
  }

  async update(id: string, dto: UpdateShopDto, requesterId: string, role: string): Promise<Shop> {
    const shop = await this.findOne(id);
    this.assertOwnerOrAdmin(shop, requesterId, role);
    return this.shopRepository.update(id, dto);
  }

  async uploadLogo(id: string, file: Express.Multer.File, requesterId: string, role: string): Promise<Shop> {
    const shop = await this.findOne(id);
    this.assertOwnerOrAdmin(shop, requesterId, role);
    if (shop.logoPublicId) await this.cloudinaryService.deleteByPublicId(shop.logoPublicId);
    const { url, publicId } = await this.cloudinaryService.uploadBuffer(file.buffer, 'pawgo/shops/logos', `shop_logo_${id}`);
    return this.shopRepository.update(id, { name: shop.name } as any);
    // Note: direct update of logo fields via prisma
  }

  async verify(id: string, requesterId: string, role: string): Promise<Shop> {
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can verify shops');
    }
    await this.findOne(id);
    return this.shopRepository.setVerified(id, true);
  }

  async suspend(id: string, requesterId: string, role: string): Promise<Shop> {
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can suspend shops');
    }
    await this.findOne(id);
    return this.shopRepository.setActive(id, false);
  }

  async activate(id: string, requesterId: string, role: string): Promise<Shop> {
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can activate shops');
    }
    await this.findOne(id);
    return this.shopRepository.setActive(id, true);
  }

  async remove(id: string, role: string): Promise<void> {
    if (role !== UserRole.SUPER_ADMIN) throw new ForbiddenException('Only admins can delete shops');
    await this.findOne(id);
    await this.shopRepository.softDelete(id);
    this.logger.log(`Shop soft-deleted: ${id}`);
  }

  async findByIdOrThrow(id: string): Promise<Shop> {
    return this.findOne(id);
  }

  private assertOwnerOrAdmin(shop: Shop, requesterId: string, role: string): void {
    if (role === UserRole.SUPER_ADMIN) return;
    if (shop.ownerId === requesterId) return;
    throw new ForbiddenException('You do not have permission to manage this shop');
  }
}
