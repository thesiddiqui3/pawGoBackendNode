import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SystemSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Settings ─────────────────────────────────────────────────────────────

  async findAllSettings(category?: string) {
    return this.prisma.systemSetting.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async findByKey(key: string) {
    return this.prisma.systemSetting.findUnique({ where: { key } });
  }

  async upsertSetting(
    key: string,
    value: unknown,
    meta: { description?: string; category?: string; isPublic?: boolean; updatedBy?: string },
  ) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value: value as any, ...meta, updatedBy: meta.updatedBy },
      create: { key, value: value as any, ...meta },
    });
  }

  async updateByKey(key: string, data: { value?: unknown; description?: string; isPublic?: boolean; updatedBy?: string }) {
    return this.prisma.systemSetting.update({
      where: { key },
      data: { ...(data.value !== undefined ? { value: data.value as any } : {}), description: data.description, isPublic: data.isPublic, updatedBy: data.updatedBy },
    });
  }

  async deleteSetting(key: string) {
    return this.prisma.systemSetting.delete({ where: { key } });
  }

  async deleteCamelCaseOrphans() {
    // Remove camelCase keys that have a snake_case twin — leftover from before key normalization
    const all = await this.prisma.systemSetting.findMany({ select: { key: true } });
    const snakeKeys = new Set(all.map((s) => s.key).filter((k) => !/[A-Z]/.test(k)));
    const toDelete = all
      .filter((s) => /[A-Z]/.test(s.key))
      .filter((s) => snakeKeys.has(s.key.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`)))
      .map((s) => s.key);
    if (toDelete.length > 0) {
      await this.prisma.systemSetting.deleteMany({ where: { key: { in: toDelete } } });
    }
  }

  // ─── Holidays ─────────────────────────────────────────────────────────────

  async findAllHolidays() {
    return this.prisma.globalHoliday.findMany({ orderBy: { date: 'asc' } });
  }

  async findHolidayById(id: string) {
    return this.prisma.globalHoliday.findUnique({ where: { id } });
  }

  async createHoliday(data: { name: string; date: Date; recurring?: boolean; affectsAll?: boolean; note?: string }) {
    return this.prisma.globalHoliday.create({ data });
  }

  async updateHoliday(id: string, data: Partial<{ name: string; date: Date; recurring: boolean; affectsAll: boolean; note: string }>) {
    return this.prisma.globalHoliday.update({ where: { id }, data });
  }

  async deleteHoliday(id: string) {
    return this.prisma.globalHoliday.delete({ where: { id } });
  }

  // ─── Compliance Rules ──────────────────────────────────────────────────────

  async findAllRules() {
    return this.prisma.complianceRule.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findRuleById(id: string) {
    return this.prisma.complianceRule.findUnique({ where: { id } });
  }

  async createRule(data: { rule: string; description?: string; mandatory?: boolean; order?: number }) {
    return this.prisma.complianceRule.create({ data });
  }

  async updateRule(id: string, data: Partial<{ rule: string; description: string; mandatory: boolean; isActive: boolean; order: number }>) {
    return this.prisma.complianceRule.update({ where: { id }, data });
  }

  async deleteRule(id: string) {
    return this.prisma.complianceRule.delete({ where: { id } });
  }
}
