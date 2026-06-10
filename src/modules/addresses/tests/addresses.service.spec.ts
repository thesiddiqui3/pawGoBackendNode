import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressRepository } from '../address.repository';
import { AddressesService } from '../addresses.service';

const mockRepo = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByUser: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  clearDefault: jest.fn(),
  setDefault: jest.fn(),
  count: jest.fn(),
});

const makeAddress = (overrides: Record<string, unknown> = {}) => ({
  id: 'addr-uuid',
  userId: 'user-id',
  fullName: 'John Doe',
  phone: '+919876543210',
  addressLine1: '12, Park Street',
  city: 'Mumbai',
  state: 'Maharashtra',
  country: 'India',
  pincode: '400001',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AddressesService', () => {
  let service: AddressesService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        { provide: AddressRepository, useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(AddressesService);
    repo = module.get(AddressRepository) as unknown as ReturnType<typeof mockRepo>;
  });

  describe('create', () => {
    it('creates an address for the user', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockResolvedValue(makeAddress({ isDefault: true }));

      const result = await service.create('user-id', {
        fullName: 'John Doe',
        phone: '+919876543210',
        addressLine1: '12, Park Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      });
      expect(result.isDefault).toBe(true);
    });

    it('throws BadRequestException at address limit (10)', async () => {
      repo.count.mockResolvedValue(10);
      await expect(
        service.create('user-id', { fullName: 'X', phone: '+91', addressLine1: 'Y', city: 'Z', state: 'S', pincode: '12345' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('clears existing default when isDefault is true', async () => {
      repo.count.mockResolvedValue(2);
      repo.clearDefault.mockResolvedValue(undefined);
      repo.create.mockResolvedValue(makeAddress({ isDefault: true }));

      await service.create('user-id', {
        fullName: 'John',
        phone: '+91',
        addressLine1: 'ABC',
        city: 'C',
        state: 'S',
        pincode: '12345',
        isDefault: true,
      });
      expect(repo.clearDefault).toHaveBeenCalledWith('user-id');
    });
  });

  describe('update', () => {
    it('allows owner to update address', async () => {
      repo.findById.mockResolvedValue(makeAddress());
      repo.update.mockResolvedValue(makeAddress({ city: 'Delhi' }));

      const result = await service.update('addr-uuid', { city: 'Delhi' }, 'user-id');
      expect((result as any).city).toBe('Delhi');
    });

    it('throws ForbiddenException for non-owner', async () => {
      repo.findById.mockResolvedValue(makeAddress({ userId: 'other-user' }));
      await expect(service.update('addr-uuid', {}, 'user-id')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('deletes an owned address', async () => {
      repo.findById.mockResolvedValue(makeAddress());
      repo.delete.mockResolvedValue(undefined);

      await service.remove('addr-uuid', 'user-id');
      expect(repo.delete).toHaveBeenCalledWith('addr-uuid');
    });

    it('throws NotFoundException when address not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('bad-id', 'user-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setDefault', () => {
    it('clears other defaults then sets new default', async () => {
      repo.findById.mockResolvedValue(makeAddress());
      repo.clearDefault.mockResolvedValue(undefined);
      repo.setDefault.mockResolvedValue(makeAddress({ isDefault: true }));

      const result = await service.setDefault('addr-uuid', 'user-id');
      expect(repo.clearDefault).toHaveBeenCalledWith('user-id');
      expect(result.isDefault).toBe(true);
    });
  });
});
