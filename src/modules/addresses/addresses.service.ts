import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Address } from '@prisma/client';
import { AddressRepository } from './address.repository';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

const MAX_ADDRESSES = 10;

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(private readonly addressRepository: AddressRepository) {}

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const count = await this.addressRepository.count(userId);
    if (count >= MAX_ADDRESSES) {
      throw new BadRequestException(`Maximum of ${MAX_ADDRESSES} addresses allowed`);
    }

    if (dto.isDefault) {
      await this.addressRepository.clearDefault(userId);
    }

    // First address is always default
    if (count === 0) {
      dto = { ...dto, isDefault: true };
    }

    const address = await this.addressRepository.create(userId, dto);
    this.logger.log(`Address created for user ${userId}: ${address.id}`);
    return address;
  }

  async findAll(userId: string): Promise<Address[]> {
    return this.addressRepository.findByUser(userId);
  }

  async update(
    id: string,
    dto: UpdateAddressDto,
    userId: string,
  ): Promise<Address> {
    const address = await this.findOwnedOrThrow(id, userId);
    const updated = await this.addressRepository.update(address.id, dto);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const address = await this.findOwnedOrThrow(id, userId);
    await this.addressRepository.delete(address.id);
    this.logger.log(`Address deleted: ${id}`);
  }

  async setDefault(id: string, userId: string): Promise<Address> {
    const address = await this.findOwnedOrThrow(id, userId);
    await this.addressRepository.clearDefault(userId);
    const updated = await this.addressRepository.setDefault(address.id);
    this.logger.log(`Default address set: ${id} for user ${userId}`);
    return updated;
  }

  async findByIdOrThrow(id: string): Promise<Address> {
    const address = await this.addressRepository.findById(id);
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  private async findOwnedOrThrow(id: string, userId: string): Promise<Address> {
    const address = await this.addressRepository.findById(id);
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Access denied');
    return address;
  }
}
