import { Injectable } from '@nestjs/common';
import { Appointment, AppointmentStatus, Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PrismaService } from '../../database/prisma.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';

// ─── Relation includes ────────────────────────────────────────────────────────

const APPOINTMENT_INCLUDE = {
  pet: {
    select: { id: true, name: true, species: true, breed: true, gender: true, photoUrl: true },
  },
  owner: {
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true },
  },
  clinic: {
    select: { id: true, name: true, slug: true, phone: true, email: true, address: true, city: true, logoUrl: true },
  },
  doctor: {
    select: {
      id: true,
      userId: true,
      specializations: true,
      consultationFee: true,
      photoUrl: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.AppointmentInclude;

export type AppointmentDetail = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>;

// ─── Repository ───────────────────────────────────────────────────────────────

@Injectable()
export class AppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Appointment number (race-condition safe via INSERT ON CONFLICT) ─────────

  async generateAppointmentNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.prisma.$queryRaw<{ seq: bigint }[]>`
      INSERT INTO appointment_counters (year, seq)
      VALUES (${year}, 1)
      ON CONFLICT (year) DO UPDATE
        SET seq = appointment_counters.seq + 1
      RETURNING seq
    `;
    const seq = Number(result[0].seq);
    return `PGA-${year}-${String(seq).padStart(6, '0')}`;
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(data: Prisma.AppointmentCreateInput): Promise<AppointmentDetail> {
    return this.prisma.appointment.create({ data, include: APPOINTMENT_INCLUDE });
  }

  // ─── Find by ID ───────────────────────────────────────────────────────────────

  async findById(id: string): Promise<AppointmentDetail | null> {
    return this.prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
  }

  // ─── Find by appointment number ───────────────────────────────────────────────

  async findByNumber(appointmentNumber: string): Promise<AppointmentDetail | null> {
    return this.prisma.appointment.findUnique({ where: { appointmentNumber }, include: APPOINTMENT_INCLUDE });
  }

  // ─── Find raw (no includes — for ownership checks) ───────────────────────────

  async findRaw(id: string): Promise<Appointment | null> {
    return this.prisma.appointment.findUnique({ where: { id } });
  }

  // ─── Find many (generic filtered list) ───────────────────────────────────────

  async findMany(
    where: Prisma.AppointmentWhereInput,
    query: AppointmentQueryDto,
  ): Promise<PaginatedResponseDto<AppointmentDetail>> {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        skip,
        take,
        orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
        include: APPOINTMENT_INCLUDE,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  // ─── Check double booking ─────────────────────────────────────────────────────

  async existsConflict(
    doctorId: string,
    appointmentDate: Date,
    startTime: string,
    excludeId?: string,
  ): Promise<boolean> {
    const appt = await this.prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate,
        startTime,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return !!appt;
  }

  // ─── Booked start times for a doctor on a date ───────────────────────────────

  async getBookedTimes(doctorId: string, appointmentDate: Date): Promise<string[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      },
      select: { startTime: true },
    });
    return rows.map((r) => r.startTime);
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  async update(
    id: string,
    data: Prisma.AppointmentUpdateInput,
  ): Promise<AppointmentDetail> {
    return this.prisma.appointment.update({ where: { id }, data, include: APPOINTMENT_INCLUDE });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────────

  async getStats(where: Prisma.AppointmentWhereInput): Promise<{
    today: number;
    upcoming: number;
    completed: number;
    cancelled: number;
    total: number;
  }> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

    const [today, upcoming, completed, cancelled, total] = await this.prisma.$transaction([
      this.prisma.appointment.count({
        where: { ...where, appointmentDate: { gte: startOfToday, lt: endOfToday } },
      }),
      this.prisma.appointment.count({
        where: {
          ...where,
          appointmentDate: { gte: endOfToday },
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED] },
        },
      }),
      this.prisma.appointment.count({ where: { ...where, status: AppointmentStatus.COMPLETED } }),
      this.prisma.appointment.count({ where: { ...where, status: AppointmentStatus.CANCELLED } }),
      this.prisma.appointment.count({ where }),
    ]);

    return { today, upcoming, completed, cancelled, total };
  }
}
