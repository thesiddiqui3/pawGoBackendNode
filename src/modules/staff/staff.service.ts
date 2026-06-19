import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { CreateAssistantDto, CreateClinicStaffDto, CreateDeliveryPartnerDto } from './dto/create-staff.dto';

const BCRYPT_ROUNDS = 12;

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pwd =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 6; i++) pwd += all[Math.floor(Math.random() * all.length)];
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CLINIC_OWNER creates ASSISTANT ──────────────────────────────────────

  async createAssistant(clinicOwnerId: string, dto: CreateAssistantDto) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: clinicOwnerId, deletedAt: null },
      select: { id: true, isVerified: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');
    if (!clinic.isVerified) throw new ForbiddenException('Your clinic must be verified before adding staff');

    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('A user with this email already exists');

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.ASSISTANT,
        isEmailVerified: true,
        mustChangePassword: true,
        doctorProfile: {
          create: { clinicId: clinic.id },
        },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true,
        doctorProfile: { select: { id: true, clinicId: true } },
      },
    });

    return { credentials: { email: dto.email, temporaryPassword }, user };
  }

  // ─── CLINIC_OWNER creates any clinic role (manager/receptionist/assistant) ─

  async createClinicStaff(clinicOwnerId: string, dto: CreateClinicStaffDto) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: clinicOwnerId, deletedAt: null },
      select: { id: true, isVerified: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');
    if (!clinic.isVerified) throw new ForbiddenException('Your clinic must be verified before adding staff');

    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('A user with this email already exists');

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        isEmailVerified: true,
        mustChangePassword: true,
        ...(dto.role === UserRole.ASSISTANT && {
          doctorProfile: { create: { clinicId: clinic.id } },
        }),
        clinicStaff: {
          create: { clinicId: clinic.id, role: dto.role, addedBy: clinicOwnerId },
        },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true,
        clinicStaff: { select: { id: true, clinicId: true, role: true } },
      },
    });

    return { credentials: { email: dto.email, temporaryPassword }, user };
  }

  async listAllClinicStaff(clinicOwnerId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: clinicOwnerId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');

    return this.prisma.clinicStaff.findMany({
      where: { clinicId: clinic.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deactivateClinicStaff(clinicOwnerId: string, staffUserId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: clinicOwnerId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const staff = await this.prisma.clinicStaff.findFirst({
      where: { clinicId: clinic.id, userId: staffUserId },
    });
    if (!staff) throw new NotFoundException('Staff member not found at your clinic');

    await this.prisma.clinicStaff.update({
      where: { id: staff.id },
      data: { isActive: false },
    });
    await this.prisma.user.update({
      where: { id: staffUserId },
      data: { status: 'INACTIVE' },
    });

    return { message: 'Staff member deactivated' };
  }

  async removeClinicStaff(clinicOwnerId: string, staffUserId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: clinicOwnerId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const staff = await this.prisma.clinicStaff.findFirst({
      where: { clinicId: clinic.id, userId: staffUserId },
    });
    if (!staff) throw new NotFoundException('Staff member not found at your clinic');

    await this.prisma.clinicStaff.delete({ where: { id: staff.id } });
    await this.prisma.user.update({
      where: { id: staffUserId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Staff member removed' };
  }

  async listClinicAssistants(clinicOwnerId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: clinicOwnerId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');

    return this.prisma.doctor.findMany({
      where: { clinicId: clinic.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
      },
    });
  }

  // ─── SHOP_OWNER creates DELIVERY_PARTNER ─────────────────────────────────

  async createDeliveryPartner(shopOwnerId: string, dto: CreateDeliveryPartnerDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: shopOwnerId },
      select: { id: true },
    });
    if (!shop) throw new NotFoundException('Shop not found');

    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('A user with this email already exists');

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const vehicleType = String(dto.vehicleType ?? 'BIKE').toUpperCase().replace(/\s+/g, '_');

    await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.DELIVERY_PARTNER,
        isEmailVerified: true,
        mustChangePassword: true,
        deliveryPartner: {
          create: {
            vehicleType: vehicleType as any,
            vehicleNumber: dto.vehicleNumber ?? 'TBD',
            drivingLicense: 'TBD',
            aadhaarNumber: 'TBD',
            emergencyContact: dto.phone ?? 'TBD',
            createdBy: shopOwnerId,
          },
        },
      },
    });

    // Fetch the full partner record for the response
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: { createdBy: shopOwnerId, user: { email: dto.email } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
      },
    });

    return { credentials: { email: dto.email, temporaryPassword }, user: partner };
  }

  async activateClinicStaff(clinicOwnerId: string, staffUserId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: clinicOwnerId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const staff = await this.prisma.clinicStaff.findFirst({
      where: { clinicId: clinic.id, userId: staffUserId },
    });
    if (!staff) throw new NotFoundException('Staff member not found at your clinic');

    await this.prisma.clinicStaff.update({ where: { id: staff.id }, data: { isActive: true } });
    await this.prisma.user.update({ where: { id: staffUserId }, data: { status: 'ACTIVE' } });
    return { message: 'Staff member activated' };
  }

  async getClinicAssistantById(clinicOwnerId: string, doctorId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: clinicOwnerId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId: clinic.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
      },
    });
    if (!doctor) throw new NotFoundException('Assistant not found');
    return doctor;
  }

  async listShopDeliveryPartners(shopOwnerId: string, query: { page?: number; limit?: number; search?: string; status?: string } = {}) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.limit ?? 10);
    const skip = (page - 1) * pageSize;

    const where: any = {
      createdBy: shopOwnerId,
      user: {
        deletedAt: null,
        ...(query.search ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      ...(query.status === 'suspended' ? { suspendedAt: { not: null } } : {}),
      ...(query.status === 'active' ? { isApproved: true, suspendedAt: null } : {}),
      ...(query.status === 'inactive' ? { isApproved: false, suspendedAt: null } : {}),
    };

    const include = {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.deliveryPartner.findMany({ where, include, skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
      this.prisma.deliveryPartner.count({ where }),
    ]);

    return {
      data: items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getShopDeliveryPartnerById(shopOwnerId: string, partnerId: string) {
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: { id: partnerId, createdBy: shopOwnerId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
      },
    });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return partner;
  }

  async updateShopDeliveryPartner(shopOwnerId: string, partnerId: string, dto: { vehicleType?: string; vehicleNumber?: string; phone?: string }) {
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: { id: partnerId, createdBy: shopOwnerId },
    });
    if (!partner) throw new NotFoundException('Delivery partner not found');

    return this.prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: {
        ...(dto.vehicleType ? { vehicleType: dto.vehicleType.toUpperCase().replace(/\s+/g, '_') as any } : {}),
        ...(dto.vehicleNumber ? { vehicleNumber: dto.vehicleNumber } : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
      },
    });
  }

  async updateShopDeliveryPartnerStatus(shopOwnerId: string, partnerId: string, status: string) {
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: { id: partnerId, createdBy: shopOwnerId },
      select: { id: true, userId: true },
    });
    if (!partner) throw new NotFoundException('Delivery partner not found');

    const isSuspend = status === 'SUSPENDED' || status === 'suspended';

    const [updated] = await this.prisma.$transaction([
      this.prisma.deliveryPartner.update({
        where: { id: partnerId },
        data: isSuspend
          ? { isApproved: false, isOnline: false, isAvailable: false, suspendedAt: new Date(), suspendedBy: shopOwnerId }
          : { isApproved: true, suspendedAt: null, suspendedBy: null, suspendReason: null },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
        },
      }),
      this.prisma.user.update({
        where: { id: partner.userId },
        data: { status: isSuspend ? 'SUSPENDED' : 'ACTIVE' },
      }),
    ]);

    return updated;
  }
}
