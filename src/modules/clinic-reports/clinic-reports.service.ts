import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';

@Injectable()
export class ClinicReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveClinicId(userId: string, role: string, clinicId?: string): Promise<string> {
    if (role === UserRole.SUPER_ADMIN && clinicId) return clinicId;
    const owned = await this.prisma.clinic.findFirst({ where: { createdBy: userId, deletedAt: null } });
    if (owned) return owned.id;
    const staff = await this.prisma.clinicStaff.findUnique({ where: { userId }, select: { clinicId: true } });
    if (staff) return staff.clinicId;
    throw new NotFoundException('You are not associated with a clinic');
  }

  // ─── Appointment Report ───────────────────────────────────────────────────

  async appointmentReport(userId: string, role: string, from?: string, to?: string, clinicId?: string) {
    const cid = await this.resolveClinicId(userId, role, clinicId);
    const dateFilter = this.buildDateFilter(from, to, 'appointmentDate');

    const appointments = await this.prisma.appointment.findMany({
      where: { clinicId: cid, ...dateFilter },
      include: {
        pet: { select: { name: true, species: true } },
        owner: { select: { firstName: true, lastName: true, phone: true } },
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { appointmentDate: 'asc' },
    });

    const byStatus = await this.prisma.appointment.groupBy({
      by: ['status'],
      where: { clinicId: cid, ...dateFilter },
      _count: { status: true },
    });

    return {
      total: appointments.length,
      byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count.status])),
      appointments,
      from,
      to,
    };
  }

  // ─── Revenue Report ───────────────────────────────────────────────────────

  async revenueReport(userId: string, role: string, from?: string, to?: string, clinicId?: string) {
    const cid = await this.resolveClinicId(userId, role, clinicId);

    const completedAppts = await this.prisma.appointment.findMany({
      where: { clinicId: cid, status: 'COMPLETED', ...this.buildDateFilter(from, to, 'createdAt') },
      include: { doctor: { select: { consultationFee: true, id: true } } },
    });

    const completedBookings = await this.prisma.serviceBooking.findMany({
      where: { service: { clinicId: cid }, status: 'COMPLETED', ...this.buildDateFilter(from, to, 'completedAt') },
      select: { totalPrice: true, completedAt: true, service: { select: { name: true, category: true } } },
    });

    const apptRevenue = completedAppts.reduce((sum, a) => sum + (a.doctor.consultationFee ?? 0), 0);
    const serviceRevenue = (completedBookings as any[]).reduce((sum: number, b: any) => sum + b.totalPrice, 0);

    // Group by doctor
    const byDoctor: Record<string, number> = {};
    for (const a of completedAppts) {
      const fee = a.doctor.consultationFee ?? 0;
      byDoctor[a.doctor.id] = (byDoctor[a.doctor.id] ?? 0) + fee;
    }

    return {
      period: { from, to },
      appointmentRevenue: apptRevenue,
      serviceRevenue,
      totalRevenue: apptRevenue + serviceRevenue,
      totalCompletedAppointments: completedAppts.length,
      totalCompletedServiceBookings: completedBookings.length,
      revenueByDoctor: byDoctor,
    };
  }

  // ─── Vaccination Report ───────────────────────────────────────────────────

  async vaccinationReport(userId: string, role: string, from?: string, to?: string, clinicId?: string) {
    const cid = await this.resolveClinicId(userId, role, clinicId);

    const vaccinations = await this.prisma.vaccination.findMany({
      where: { clinicId: cid, ...this.buildDateFilter(from, to, 'dateAdministered') },
      include: {
        pet: { select: { name: true, species: true, breed: true } },
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { dateAdministered: 'desc' },
    });

    const byVaccine: Record<string, number> = {};
    for (const v of vaccinations) {
      byVaccine[v.vaccineName] = (byVaccine[v.vaccineName] ?? 0) + 1;
    }

    return {
      total: vaccinations.length,
      byVaccine,
      vaccinations,
      from,
      to,
    };
  }

  // ─── Doctor Performance Report ────────────────────────────────────────────

  async doctorPerformanceReport(userId: string, role: string, from?: string, to?: string, clinicId?: string) {
    const cid = await this.resolveClinicId(userId, role, clinicId);

    const doctors = await this.prisma.doctor.findMany({
      where: { clinicId: cid },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        appointments: {
          where: this.buildDateFilter(from, to, 'appointmentDate'),
          select: { status: true },
        },
        reviews: { select: { rating: true } },
      },
    });

    return doctors.map((d) => {
      const total = d.appointments.length;
      const completed = d.appointments.filter((a) => a.status === 'COMPLETED').length;
      const cancelled = d.appointments.filter((a) => a.status === 'CANCELLED').length;
      const noShow = d.appointments.filter((a) => a.status === 'NO_SHOW').length;
      const avgRating = d.reviews.length
        ? d.reviews.reduce((sum, r) => sum + r.rating, 0) / d.reviews.length
        : 0;

      return {
        doctorId: d.id,
        name: `${d.user.firstName} ${d.user.lastName}`,
        specializations: d.specializations,
        consultationFee: d.consultationFee,
        totalAppointments: total,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShow,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: d.reviews.length,
      };
    });
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  private buildDateFilter(from?: string, to?: string, field = 'createdAt'): Record<string, any> {
    if (!from && !to) return {};
    const filter: Record<string, any> = {};
    if (from) filter.gte = new Date(from);
    if (to) filter.lte = new Date(to);
    return { [field]: filter };
  }
}
