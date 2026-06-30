import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { EMAIL_SERVICE, IEmailService } from '../../shared/email/email.interface';
import { emailTemplates } from '../../shared/email/email-templates';
import { geocodeAddress } from '../../common/utils/geocode.util';
import { FieldAgentsService } from '../field-agents/field-agents.service';

const BCRYPT_ROUNDS = 12;

export interface ProvisionClinicDto {
  // Owner account
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerPhone?: string;
  // Clinic info
  clinicName: string;
  clinicPhone: string;
  licenseNumber: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  // Optional: field agent who onboarded this clinic
  onboardedByAgentId?: string;
}

export interface ProvisionShopDto {
  // Owner account
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerPhone?: string;
  // Shop info
  shopName: string;
  shopPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  // Optional: field agent who onboarded this shop
  onboardedByAgentId?: string;
}

export interface ProvisionResult {
  credentials: { email: string; temporaryPassword: string };
  entity: object;
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pwd = upper[Math.floor(Math.random() * upper.length)]
    + lower[Math.floor(Math.random() * lower.length)]
    + digits[Math.floor(Math.random() * digits.length)]
    + special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 6; i++) pwd += all[Math.floor(Math.random() * all.length)];
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

@Injectable()
export class AdminProvisionService {
  private readonly logger = new Logger(AdminProvisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
    private readonly fieldAgentsService: FieldAgentsService,
  ) {}

  async provisionClinic(dto: ProvisionClinicDto): Promise<ProvisionResult> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (exists) throw new ConflictException('A user with this email already exists');

    if (dto.ownerPhone) {
      const phoneExists = await this.prisma.user.findUnique({ where: { phone: dto.ownerPhone } });
      if (phoneExists) throw new ConflictException('A user with this phone number already exists');
    }

    // Validate agent permissions if onboarding via field agent
    if (dto.onboardedByAgentId) {
      await this.fieldAgentsService.assertCanOnboardClinic(dto.onboardedByAgentId);
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.ownerFirstName,
        lastName: dto.ownerLastName,
        email: dto.ownerEmail,
        phone: dto.ownerPhone,
        passwordHash,
        role: UserRole.CLINIC_OWNER,
        isEmailVerified: true,
        mustChangePassword: true,
      },
    });

    const baseSlug = toSlug(dto.clinicName);
    const existing = await this.prisma.clinic.count({ where: { slug: { startsWith: baseSlug } } });
    const slug = existing > 0 ? `${baseSlug}-${existing + 1}` : baseSlug;

    let latitude = dto.latitude;
    let longitude = dto.longitude;
    if (!latitude || !longitude) {
      const geo = await geocodeAddress(dto.address, dto.city, dto.state);
      if (geo) { latitude = geo.latitude; longitude = geo.longitude; }
    }

    const clinic = await this.prisma.clinic.create({
      data: {
        name: dto.clinicName,
        phone: dto.clinicPhone,
        licenseNumber: dto.licenseNumber,
        email: dto.ownerEmail,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        description: dto.description,
        slug,
        createdBy: user.id,
        services: [],
        ...(latitude && longitude && { latitude, longitude }),
        ...(dto.onboardedByAgentId && {
          onboardedByAgentId: dto.onboardedByAgentId,
          onboardedAt: new Date(),
        }),
      },
    });

    // Increment agent counter asynchronously
    if (dto.onboardedByAgentId) {
      this.fieldAgentsService
        .recordClinicOnboarding(dto.onboardedByAgentId)
        .catch((err: Error) => this.logger.error(`Failed to increment agent clinic count: ${err?.message}`));
    }

    const clinicPortalUrl = this.configService.get<string>('app.clinicPortalUrl', 'http://localhost:3002');
    this.emailService
      .send({
        to: dto.ownerEmail,
        subject: `Welcome to PawGo — Your Clinic Portal Credentials`,
        html: emailTemplates.ownerInvite(
          dto.ownerFirstName,
          dto.clinicName,
          UserRole.CLINIC_OWNER,
          dto.ownerEmail,
          temporaryPassword,
          clinicPortalUrl,
        ),
      })
      .catch((err: Error) =>
        this.logger.error(`Failed to send clinic owner invite email to ${dto.ownerEmail}: ${err?.message}`),
      );

    return {
      credentials: { email: dto.ownerEmail, temporaryPassword },
      entity: clinic,
    };
  }

  async provisionShop(dto: ProvisionShopDto): Promise<ProvisionResult> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (exists) throw new ConflictException('A user with this email already exists');

    if (dto.ownerPhone) {
      const phoneExists = await this.prisma.user.findUnique({ where: { phone: dto.ownerPhone } });
      if (phoneExists) throw new ConflictException('A user with this phone number already exists');
    }

    // Validate agent permissions if onboarding via field agent
    if (dto.onboardedByAgentId) {
      await this.fieldAgentsService.assertCanOnboardShop(dto.onboardedByAgentId);
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.ownerFirstName,
        lastName: dto.ownerLastName,
        email: dto.ownerEmail,
        phone: dto.ownerPhone,
        passwordHash,
        role: UserRole.SHOP_OWNER,
        isEmailVerified: true,
        mustChangePassword: true,
      },
    });

    const baseSlug = toSlug(dto.shopName);
    const existingShop = await this.prisma.shop.count({ where: { slug: { startsWith: baseSlug } } });
    const shopSlug = existingShop > 0 ? `${baseSlug}-${existingShop + 1}` : baseSlug;

    let shopLat = dto.latitude;
    let shopLng = dto.longitude;
    if (!shopLat || !shopLng) {
      const shopGeo = dto.address && dto.city && dto.state
        ? await geocodeAddress(dto.address, dto.city, dto.state)
        : null;
      if (shopGeo) { shopLat = shopGeo.latitude; shopLng = shopGeo.longitude; }
    }

    const shop = await this.prisma.shop.create({
      data: {
        name: dto.shopName,
        slug: shopSlug,
        phone: dto.shopPhone,
        email: dto.ownerEmail,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        description: dto.description,
        ownerId: user.id,
        createdBy: user.id,
        ...(shopLat && shopLng && { latitude: shopLat, longitude: shopLng }),
        ...(dto.onboardedByAgentId && {
          onboardedByAgentId: dto.onboardedByAgentId,
          onboardedAt: new Date(),
        }),
      },
    });

    // Increment agent counter asynchronously
    if (dto.onboardedByAgentId) {
      this.fieldAgentsService
        .recordShopOnboarding(dto.onboardedByAgentId)
        .catch((err: Error) => this.logger.error(`Failed to increment agent shop count: ${err?.message}`));
    }

    const shopPortalUrl = this.configService.get<string>('app.shopPortalUrl', 'http://localhost:3003');
    this.emailService
      .send({
        to: dto.ownerEmail,
        subject: `Welcome to PawGo — Your Shop Portal Credentials`,
        html: emailTemplates.ownerInvite(
          dto.ownerFirstName,
          dto.shopName,
          UserRole.SHOP_OWNER,
          dto.ownerEmail,
          temporaryPassword,
          shopPortalUrl,
        ),
      })
      .catch((err: Error) =>
        this.logger.error(`Failed to send shop owner invite email to ${dto.ownerEmail}: ${err?.message}`),
      );

    return {
      credentials: { email: dto.ownerEmail, temporaryPassword },
      entity: shop,
    };
  }
}
