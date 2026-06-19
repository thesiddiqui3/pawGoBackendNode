import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemSettingsRepository } from '../system-settings.repository';
import { SystemSettingsService } from '../system-settings.service';

const mockRepo = () => ({
  findAllSettings: jest.fn(),
  findByKey: jest.fn(),
  upsertSetting: jest.fn(),
  updateByKey: jest.fn(),
  deleteSetting: jest.fn(),
  findAllHolidays: jest.fn(),
  findHolidayById: jest.fn(),
  createHoliday: jest.fn(),
  updateHoliday: jest.fn(),
  deleteHoliday: jest.fn(),
  findAllRules: jest.fn(),
  findRuleById: jest.fn(),
  createRule: jest.fn(),
  updateRule: jest.fn(),
  deleteRule: jest.fn(),
});

const ADMIN_ID = 'admin-uuid';

describe('SystemSettingsService', () => {
  let service: SystemSettingsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemSettingsService,
        { provide: SystemSettingsRepository, useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(SystemSettingsService);
    repo = module.get(SystemSettingsRepository) as unknown as ReturnType<typeof mockRepo>;
  });

  describe('getSettings', () => {
    it('returns all settings', async () => {
      repo.findAllSettings.mockResolvedValue([]);
      await service.getSettings();
      expect(repo.findAllSettings).toHaveBeenCalledWith(undefined);
    });

    it('filters by category', async () => {
      repo.findAllSettings.mockResolvedValue([]);
      await service.getSettings('fees');
      expect(repo.findAllSettings).toHaveBeenCalledWith('fees');
    });
  });

  describe('getSetting', () => {
    it('returns setting when found', async () => {
      repo.findByKey.mockResolvedValue({ key: 'app_name', value: 'PawGo' });
      const result = await service.getSetting('app_name');
      expect((result as any).key).toBe('app_name');
    });

    it('throws NotFoundException when key not found', async () => {
      repo.findByKey.mockResolvedValue(null);
      await expect(service.getSetting('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSetting', () => {
    it('upserts a setting', async () => {
      repo.upsertSetting.mockResolvedValue({ key: 'tax_percent', value: 18 });
      const result = await service.createSetting(
        { key: 'tax_percent', value: 18, category: 'fees' },
        ADMIN_ID,
      );
      expect(repo.upsertSetting).toHaveBeenCalledWith('tax_percent', 18, expect.objectContaining({ category: 'fees', updatedBy: ADMIN_ID }));
      expect((result as any).key).toBe('tax_percent');
    });
  });

  describe('updateSetting', () => {
    it('upserts the setting using snake_case key', async () => {
      repo.upsertSetting.mockResolvedValue({ key: 'tax_percent', value: 20 });
      repo.findByKey.mockResolvedValue(null);
      await service.updateSetting('tax_percent', { value: 20 }, ADMIN_ID);
      expect(repo.upsertSetting).toHaveBeenCalledWith('tax_percent', 20, expect.objectContaining({ updatedBy: ADMIN_ID }));
    });

    it('also updates camelCase key when it exists', async () => {
      repo.upsertSetting.mockResolvedValue({ key: 'taxPercent', value: 20 });
      repo.findByKey.mockResolvedValue({ key: 'taxPercent', value: 18 });
      await service.updateSetting('taxPercent', { value: 20 }, ADMIN_ID);
      expect(repo.upsertSetting).toHaveBeenCalledWith('tax_percent', 20, expect.objectContaining({ updatedBy: ADMIN_ID }));
    });
  });

  describe('holidays', () => {
    it('creates a holiday', async () => {
      repo.createHoliday.mockResolvedValue({ id: 'h1', name: 'Diwali', date: new Date('2025-10-20') });
      const result = await service.createHoliday({ name: 'Diwali', date: '2025-10-20' });
      expect((result as any).name).toBe('Diwali');
    });

    it('throws NotFoundException when updating non-existent holiday', async () => {
      repo.findHolidayById.mockResolvedValue(null);
      await expect(service.updateHoliday('bad-id', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('compliance rules', () => {
    it('creates a rule', async () => {
      repo.createRule.mockResolvedValue({ id: 'r1', rule: 'Must have cert', mandatory: true });
      const result = await service.createRule({ rule: 'Must have cert', mandatory: true });
      expect((result as any).rule).toBe('Must have cert');
    });

    it('throws NotFoundException when updating non-existent rule', async () => {
      repo.findRuleById.mockResolvedValue(null);
      await expect(service.updateRule('bad-id', { rule: 'X' })).rejects.toThrow(NotFoundException);
    });
  });
});
