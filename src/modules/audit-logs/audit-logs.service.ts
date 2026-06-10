import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditLogRepository, CreateAuditLogInput } from './audit-log.repository';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly repo: AuditLogRepository) {}

  async log(input: CreateAuditLogInput) {
    return this.repo.log(input).catch(() => {
      // Audit log failures must never break the main flow
    });
  }

  async findAll(query: AuditLogQueryDto) {
    return this.repo.findMany(query);
  }

  // ─── Convenience helpers used by other services ───────────────────────────

  logAction(
    action: AuditAction,
    entity: string,
    entityId: string,
    userId?: string,
    meta?: Record<string, unknown>,
  ) {
    return this.log({ userId, action, entity, entityId, metadata: meta });
  }
}
