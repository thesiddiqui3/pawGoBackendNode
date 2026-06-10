import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateComplianceRuleDto, UpdateComplianceRuleDto } from './dto/compliance-rule.dto';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';
import { CreateSettingDto, UpdateSettingDto } from './dto/setting.dto';
import { SystemSettingsRepository } from './system-settings.repository';

function toSnakeCase(key: string): string {
  return key.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, '');
}

function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

@Injectable()
export class SystemSettingsService {
  constructor(private readonly repo: SystemSettingsRepository) {}

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings(category?: string) {
    const all = await this.repo.findAllSettings(category);
    // Deduplicate by camelCase key (prefer snake_case rows as canonical),
    // then return all with keys transformed to camelCase so the frontend can read them.
    const seen = new Map<string, typeof all[0]>();
    for (const s of all) {
      const camelKey = toCamelCase(s.key);
      if (!seen.has(camelKey) || s.key === toSnakeCase(s.key)) {
        seen.set(camelKey, { ...s, key: camelKey });
      }
    }
    return Array.from(seen.values());
  }

  async getSetting(key: string) {
    const normalizedKey = toSnakeCase(key);
    const setting = (await this.repo.findByKey(normalizedKey)) ?? (await this.repo.findByKey(key));
    if (!setting) throw new NotFoundException(`Setting '${key}' not found`);
    return setting;
  }

  async createSetting(dto: CreateSettingDto, adminId: string) {
    const key = toSnakeCase(dto.key);
    return this.repo.upsertSetting(key, dto.value, {
      description: dto.description,
      category: dto.category ?? 'general',
      isPublic: dto.isPublic ?? false,
      updatedBy: adminId,
    });
  }

  async updateSetting(key: string, dto: UpdateSettingDto, adminId: string) {
    const snakeKey = toSnakeCase(key);
    const meta = {
      description: dto.description,
      category: dto.category ?? 'general',
      isPublic: dto.isPublic ?? false,
      updatedBy: adminId,
    };

    // Always write to the snake_case canonical key
    const result = await this.repo.upsertSetting(snakeKey, dto.value, meta);

    // Also update the camelCase row if it exists, so the frontend reads the fresh value
    if (snakeKey !== key) {
      const camelExists = await this.repo.findByKey(key);
      if (camelExists) {
        await this.repo.upsertSetting(key, dto.value, meta);
      }
    }

    return result;
  }

  async deleteSetting(key: string) {
    const normalizedKey = toSnakeCase(key);
    const existing = (await this.repo.findByKey(normalizedKey)) ?? (await this.repo.findByKey(key));
    if (!existing) throw new NotFoundException(`Setting '${key}' not found`);
    return this.repo.deleteSetting(existing.key);
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
