import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { geocodeAddress } from '../../common/utils/geocode.util';

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
  constructor(private readonly prisma: PrismaService) {}

  async provisionClinic(dto: ProvisionClinicDto): Promise<ProvisionResult> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (exists) throw new ConflictException('A user with this email already exists');

    if (dto.ownerPhone) {
      const phoneExists = await this.prisma.user.findUnique({ where: { phone: dto.ownerPhone } });
      if (phoneExists) throw new ConflictException('A user with this phone number already exists');
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
      },
    });

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
      },
    });

    return {
      credentials: { email: dto.ownerEmail, temporaryPassword },
      entity: shop,
    };
  }
}
