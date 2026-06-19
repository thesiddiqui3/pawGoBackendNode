import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class VaccinationReminderCron {
  private readonly logger = new Logger(VaccinationReminderCron.name);
  private readonly REMINDER_DAYS = [7, 3, 1];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifService: NotificationsService,
  ) {}

  @Cron('0 8 * * *') // 08:00 AM daily
  async checkVaccinationsDue() {
    this.logger.log('Running vaccination reminder check…');
    const now = new Date();

    for (const days of this.REMINDER_DAYS) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(targetDate.getDate() + 1);

      const dueVaccinations = await this.prisma.vaccination.findMany({
        where: {
          nextDueDate: { gte: targetDate, lt: nextDay },
          pet: { isActive: true, deletedAt: null },
        },
        select: {
          id: true,
          vaccineName: true,
          nextDueDate: true,
          petId: true,
          pet: { select: { id: true, name: true, ownerId: true } },
        },
      });

      for (const vacc of dueVaccinations) {
        if (!vacc.pet) continue;
        const isEnabled = await this.isVaccinationReminderEnabled(vacc.pet.ownerId);
        if (!isEnabled) continue;

        await this.notifService.notify({
          userId: vacc.pet.ownerId,
          title: `Vaccination Reminder — ${days} day${days > 1 ? 's' : ''} left`,
          message: `${vacc.pet.name}'s ${vacc.vaccineName} vaccination is due on ${this.fmtDate(vacc.nextDueDate!)}.`,
          type: days === 1 ? NotificationType.PET_VACCINATION_DUE : NotificationType.PET_VACCINATION_REMINDER,
          data: { petId: vacc.pet.id, vaccinationId: vacc.id, daysUntilDue: String(days) },
        }).catch((err) => this.logger.error(`Failed to send vaccination reminder`, err));
      }

      this.logger.log(`Sent ${dueVaccinations.length} vaccination reminders for T+${days} days`);
    }
  }

  private async isVaccinationReminderEnabled(userId: string): Promise<boolean> {
    const prefs = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return prefs?.vaccinationReminders ?? true;
  }

  private fmtDate(date: Date): string {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
