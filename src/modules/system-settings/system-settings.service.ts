import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateComplianceRuleDto, UpdateComplianceRuleDto } from './dto/compliance-rule.dto';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';
import { CreateSettingDto, UpdateSettingDto } from './dto/setting.dto';
import { SystemSettingsRepository } from './system-settings.repository';

@Injectable()
export class SystemSettingsService {
  constructor(private readonly repo: SystemSettingsRepository) {}

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings(category?: string) {
    return this.repo.findAllSettings(category);
  }

  async getSetting(key: string) {
    const setting = await this.repo.findByKey(key);
    if (!setting) throw new NotFoundException(`Setting '${key}' not found`);
    return setting;
  }

  async createSetting(dto: CreateSettingDto, adminId: string) {
    return this.repo.upsertSetting(dto.key, dto.value, {
      description: dto.description,
      category: dto.category ?? 'general',
      isPublic: dto.isPublic ?? false,
      updatedBy: adminId,
    });
  }

  async updateSetting(key: string, dto: UpdateSettingDto, adminId: string) {
    await this.getSetting(key);
    return this.repo.updateByKey(key, {
      value: dto.value,
      description: dto.description,
      isPublic: dto.isPublic,
      updatedBy: adminId,
    });
  }

  async deleteSetting(key: string) {
    await this.getSetting(key);
    return this.repo.deleteSetting(key);
  }

  // ─── Holidays ─────────────────────────────────────────────────────────────

  async getHolidays() {
    return this.repo.findAllHolidays();
  }

  async createHoliday(dto: CreateHolidayDto) {
    return this.repo.createHoliday({
      name: dto.name,
      date: new Date(dto.date),
      recurring: dto.recurring,
      affectsAll: dto.affectsAll,
      note: dto.note,
    });
  }

  async updateHoliday(id: string, dto: UpdateHolidayDto) {
    const existing = await this.repo.findHolidayById(id);
    if (!existing) throw new NotFoundException('Holiday not found');
    return this.repo.updateHoliday(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.date ? { date: new Date(dto.date) } : {}),
      ...(dto.recurring !== undefined ? { recurring: dto.recurring } : {}),
      ...(dto.affectsAll !== undefined ? { affectsAll: dto.affectsAll } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
    });
  }

  async deleteHoliday(id: string) {
    const existing = await this.repo.findHolidayById(id);
    if (!existing) throw new NotFoundException('Holiday not found');
    return this.repo.deleteHoliday(id);
  }

  // ─── Compliance Rules ──────────────────────────────────────────────────────

  async getRules() {
    return this.repo.findAllRules();
  }

  async createRule(dto: CreateComplianceRuleDto) {
    return this.repo.createRule({
      rule: dto.rule,
      description: dto.description,
      mandatory: dto.mandatory,
      order: dto.order,
    });
  }

  async updateRule(id: string, dto: UpdateComplianceRuleDto) {
    const existing = await this.repo.findRuleById(id);
    if (!existing) throw new NotFoundException('Compliance rule not found');
    return this.repo.updateRule(id, dto as any);
  }

  async deleteRule(id: string) {
    const existing = await this.repo.findRuleById(id);
    if (!existing) throw new NotFoundException('Compliance rule not found');
    return this.repo.deleteRule(id);
  }
}
