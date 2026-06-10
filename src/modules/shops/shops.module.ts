import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../shared/cloudinary/cloudinary.module';
import { ShopRepository } from './shop.repository';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [ShopsController],
  providers: [ShopsService, ShopRepository],
  exports: [ShopsService, ShopRepository],
})
export class ShopsModule {}
