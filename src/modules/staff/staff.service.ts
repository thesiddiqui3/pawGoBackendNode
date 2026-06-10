import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { CreateAssistantDto, CreateDeliveryPartnerDto } from './dto/create-staff.dto';

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
      select: { id: true, isVerified: true },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    if (!shop.isVerified) throw new ForbiddenException('Your shop must be verified before adding delivery partners');

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
        role: UserRole.DELIVERY_PARTNER,
        isEmailVerified: true,
        mustChangePassword: true,
        deliveryPartner: {
          create: {
            vehicleType: 'BIKE' as any,
            vehicleNumber: 'TBD',
            drivingLicense: 'TBD',
            aadhaarNumber: 'TBD',
            emergencyContact: 'TBD',
            createdBy: shopOwnerId,
          },
        },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true,
        deliveryPartner: { select: { id: true } },
      },
    });

    return { credentials: { email: dto.email, temporaryPassword }, user };
  }

  async listShopDeliveryPartners(shopOwnerId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: shopOwnerId },
      select: { id: true },
    });
    if (!shop) throw new NotFoundException('Shop not found');

    return this.prisma.deliveryPartner.findMany({
      where: { user: { deletedAt: null } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
      },
    });
  }
}
