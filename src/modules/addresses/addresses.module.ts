import { Module } from '@nestjs/common';
import { AddressRepository } from './address.repository';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

@Module({
  controllers: [AddressesController],
  providers: [AddressesService, AddressRepository],
  exports: [AddressesService, AddressRepository],
})
export class AddressesModule {}
