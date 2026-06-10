import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { PetRepository } from '../pet.repository';
import { PetsService } from '../pets.service';

const mockPetRepository = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndOwner: jest.fn(),
  findManyByOwner: jest.fn(),
  update: jest.fn(),
  updatePhoto: jest.fn(),
  removePhoto: jest.fn(),
  softDelete: jest.fn(),
  existsByMicrochip: jest.fn(),
  getDashboardStats: jest.fn(),
});

const mockCloudinaryService = () => ({
  uploadBuffer: jest.fn(),
  deleteByPublicId: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue('pawgo/pets'),
});

describe('PetsService — Dashboard', () => {
  let service: PetsService;
  let repo: ReturnType<typeof mockPetRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        { provide: PetRepository, useFactory: mockPetRepository },
        { provide: CloudinaryService, useFactory: mockCloudinaryService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get(PetsService);
    repo = module.get(PetRepository) as unknown as ReturnType<typeof mockPetRepository>;
  });

  describe('getDashboard', () => {
    it('returns dashboard stats for the pet owner', async () => {
      const stats = {
        totalPets: 4,
        bySpecies: { DOG: 2, CAT: 1, BIRD: 1 },
        upcomingVaccinations: 3,
        medicalRecords: 12,
      };
      repo.getDashboardStats.mockResolvedValue(stats);

      const result = await service.getDashboard('owner-id');
      expect(result).toEqual(stats);
      expect(repo.getDashboardStats).toHaveBeenCalledWith('owner-id');
    });

    it('returns zeros for an owner with no pets', async () => {
      const stats = { totalPets: 0, bySpecies: {}, upcomingVaccinations: 0, medicalRecords: 0 };
      repo.getDashboardStats.mockResolvedValue(stats);

      const result = await service.getDashboard('new-owner-id');
      expect((result as any).totalPets).toBe(0);
    });
  });
});
