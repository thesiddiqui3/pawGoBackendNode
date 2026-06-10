import { PrismaService } from '../../database/prisma.service';

const DEFAULT_SETTINGS = [
  // General
  { key: 'app_name', value: 'PawGo', category: 'general', description: 'Application name', isPublic: true },
  { key: 'support_email', value: 'support@pawgo.com', category: 'general', description: 'Support email', isPublic: true },
  { key: 'support_phone', value: '+91 98765 43210', category: 'general', description: 'Support phone', isPublic: true },
  { key: 'maintenance_mode', value: false, category: 'general', description: 'Enable maintenance mode' },
  { key: 'notifications_enabled', value: true, category: 'general', description: 'Global notifications toggle' },
  // Fees
  { key: 'platform_fee_percent', value: 5, category: 'fees', description: 'Platform fee %' },
  { key: 'service_charge_percent', value: 2, category: 'fees', description: 'Service charge %' },
  { key: 'delivery_charge_base', value: 49, category: 'fees', description: 'Base delivery charge (INR)' },
  { key: 'tax_percent', value: 18, category: 'fees', description: 'Tax %' },
  // Appointments
  { key: 'appointment_platform_fee', value: 49, category: 'appointments', description: 'Appointment platform fee (INR)' },
  { key: 'max_advance_booking_days', value: 60, category: 'appointments', description: 'Max days ahead to book' },
  { key: 'min_notice_minutes', value: 30, category: 'appointments', description: 'Minimum notice in minutes' },
  { key: 'doctor_selection_enabled', value: true, category: 'appointments', description: 'Allow pet owner to choose doctor' },
  { key: 'emergency_booking_enabled', value: true, category: 'appointments', description: 'Enable emergency bookings' },
  { key: 'emergency_surcharge', value: 200, category: 'appointments', description: 'Emergency booking surcharge (INR)' },
  { key: 'require_clinic_approval', value: true, category: 'appointments', description: 'Clinic must approve appointments' },
  { key: 'auto_confirm_after_minutes', value: 0, category: 'appointments', description: '0 = manual; >0 = auto-confirm after N minutes' },
  // Notifications
  { key: 'push_notifications_enabled', value: true, category: 'notifications', description: 'FCM push notifications' },
  { key: 'email_notifications_enabled', value: true, category: 'notifications', description: 'Email notifications' },
  { key: 'sms_notifications_enabled', value: false, category: 'notifications', description: 'SMS notifications' },
];

const DEFAULT_HOLIDAYS = [
  { name: 'Republic Day', date: new Date('2025-01-26'), recurring: true, affectsAll: true, note: 'National holiday' },
  { name: 'Independence Day', date: new Date('2025-08-15'), recurring: true, affectsAll: true, note: 'National holiday' },
  { name: 'Gandhi Jayanti', date: new Date('2025-10-02'), recurring: true, affectsAll: true, note: 'National holiday' },
];

const DEFAULT_COMPLIANCE_RULES = [
  { rule: 'Clinics must have a valid registration certificate', mandatory: true, order: 1 },
  { rule: 'All doctors must provide valid VCIN registration', mandatory: true, order: 2 },
  { rule: 'Shops must comply with pet product safety standards', mandatory: true, order: 3 },
  { rule: 'Delivery partners must have valid driving license', mandatory: true, order: 4 },
  { rule: 'Emergency cases must be attended within 30 minutes', mandatory: false, order: 5 },
];

export async function seedSystemSettings(prisma: PrismaService) {
  for (const s of DEFAULT_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value as any, category: s.category, description: s.description, isPublic: s.isPublic ?? false },
    });
  }

  const holidayCount = await prisma.globalHoliday.count();
  if (holidayCount === 0) {
    await prisma.globalHoliday.createMany({ data: DEFAULT_HOLIDAYS });
  }

  const ruleCount = await prisma.complianceRule.count();
  if (ruleCount === 0) {
    await prisma.complianceRule.createMany({ data: DEFAULT_COMPLIANCE_RULES });
  }
}
