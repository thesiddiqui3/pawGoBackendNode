import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { EMAIL_SERVICE, IEmailService } from '../../shared/email/email.interface';
import { emailTemplates } from '../../shared/email/email-templates';
import { geocodeAddress } from '../../common/utils/geocode.util';
import { FieldAgentRepository } from './field-agent.repository';
import { CreateFieldAgentDto } from './dto/create-field-agent.dto';
import { UpdateFieldAgentDto, SuspendFieldAgentDto } from './dto/update-field-agent.dto';

export interface AgentOnboardClinicDto {
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerPhone?: string;
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

export interface AgentOnboardShopDto {
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerPhone?: string;
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
export class FieldAgentsService {
  private readonly logger = new Logger(FieldAgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: FieldAgentRepository,
    private readonly configService: ConfigService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
  ) {}

  // ── Create agent (admin only) ─────────────────────────────────────────────

  async create(dto: CreateFieldAgentDto, createdBy: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.FIELD_AGENT,
        isEmailVerified: true,
        mustChangePassword: true,
      },
    });

    const agent = await this.repo.create({
      user: { connect: { id: user.id } },
      canOnboardClinics: dto.canOnboardClinics ?? true,
      canOnboardShops: dto.canOnboardShops ?? true,
      assignedCity: dto.assignedCity,
      assignedState: dto.assignedState,
      assignedRegion: dto.assignedRegion,
      createdBy,
    });

    const adminPortalUrl = this.configService.get<string>('app.frontendUrl', 'http://localhost:5173');
    this.emailService
      .send({
        to: dto.email,
        subject: 'Welcome to PawGo — Your Field Agent Credentials',
        html: emailTemplates.fieldAgentInvite(
          dto.firstName,
          dto.email,
          temporaryPassword,
          adminPortalUrl,
          dto.assignedCity,
          dto.assignedState,
        ),
      })
      .catch((err: Error) =>
        this.logger.error(`Failed to send field agent invite to ${dto.email}: ${err?.message}`),
      );

    this.logger.log(`Field agent created: ${user.email}`);
    return { credentials: { email: dto.email, temporaryPassword }, agent };
  }

  // ── List / get ────────────────────────────────────────────────────────────

  async findAll(params: {
    search?: string;
    assignedCity?: string;
    assignedState?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    return this.repo.findMany(params);
  }

  async findOne(id: string) {
    const agent = await this.repo.findById(id);
    if (!agent) throw new NotFoundException('Field agent not found');
    return agent;
  }

  async findMe(userId: string) {
    const agent = await this.repo.findByUserId(userId);
    if (!agent) throw new NotFoundException('Field agent profile not found');
    return agent;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateFieldAgentDto) {
    await this.findOne(id);
    return this.repo.update(id, dto);
  }

  // ── Suspend / Activate ────────────────────────────────────────────────────

  async suspend(id: string, suspendedBy: string, dto: SuspendFieldAgentDto) {
    const agent = await this.findOne(id);
    if (!agent.isActive) throw new ConflictException('Agent is already suspended');
    return this.repo.update(id, {
      isActive: false,
      suspendedAt: new Date(),
      suspendedBy,
      suspendNote: dto.reason,
    });
  }

  async activate(id: string) {
    const agent = await this.findOne(id);
    if (agent.isActive) throw new ConflictException('Agent is already active');
    return this.repo.update(id, {
      isActive: true,
      suspendedAt: null,
      suspendedBy: null,
      suspendNote: null,
    });
  }

  // ── Onboarded entities ────────────────────────────────────────────────────

  async getOnboardedClinics(agentId: string, page = 1, limit = 20) {
    await this.findOne(agentId);
    return this.repo.getOnboardedClinics(agentId, page, limit);
  }

  async getOnboardedShops(agentId: string, page = 1, limit = 20) {
    await this.findOne(agentId);
    return this.repo.getOnboardedShops(agentId, page, limit);
  }

  // ── Provision helpers (called by AdminProvisionService) ───────────────────

  async assertCanOnboardClinic(agentId: string): Promise<void> {
    const agent = await this.repo.findById(agentId);
    if (!agent || !agent.isActive) throw new ForbiddenException('Agent account is inactive');
    if (!agent.canOnboardClinics) throw new ForbiddenException('Agent does not have permission to onboard clinics');
  }

  async assertCanOnboardShop(agentId: string): Promise<void> {
    const agent = await this.repo.findById(agentId);
    if (!agent || !agent.isActive) throw new ForbiddenException('Agent account is inactive');
    if (!agent.canOnboardShops) throw new ForbiddenException('Agent does not have permission to onboard shops');
  }

  async recordClinicOnboarding(agentId: string): Promise<void> {
    await this.repo.incrementOnboardedClinics(agentId);
  }

  async recordShopOnboarding(agentId: string): Promise<void> {
    await this.repo.incrementOnboardedShops(agentId);
  }

  // ── Agent self-service onboarding ─────────────────────────────────────────

  async onboardClinic(userId: string, dto: AgentOnboardClinicDto) {
    const agent = await this.findMe(userId);
    await this.assertCanOnboardClinic(agent.id);

    const exists = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (exists) throw new ConflictException('A user with this email already exists');

    if (dto.ownerPhone) {
      const phoneExists = await this.prisma.user.findUnique({ where: { phone: dto.ownerPhone } });
      if (phoneExists) throw new ConflictException('A user with this phone number already exists');
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const owner = await this.prisma.user.create({
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

    const baseSlug = dto.clinicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
        createdBy: owner.id,
        services: [],
        onboardedByAgentId: agent.id,
        onboardedAt: new Date(),
        ...(latitude && longitude && { latitude, longitude }),
      },
    });

    this.repo.incrementOnboardedClinics(agent.id).catch((err: Error) =>
      this.logger.error(`Failed to increment clinic count for agent ${agent.id}: ${err?.message}`),
    );

    const clinicPortalUrl = this.configService.get<string>('app.clinicPortalUrl', 'http://localhost:3002');
    this.emailService
      .send({
        to: dto.ownerEmail,
        subject: 'Welcome to PawGo — Your Clinic Portal Credentials',
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
        this.logger.error(`Failed to send clinic invite to ${dto.ownerEmail}: ${err?.message}`),
      );

    return { credentials: { email: dto.ownerEmail, temporaryPassword }, entity: clinic };
  }

  async onboardShop(userId: string, dto: AgentOnboardShopDto) {
    const agent = await this.findMe(userId);
    await this.assertCanOnboardShop(agent.id);

    const exists = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (exists) throw new ConflictException('A user with this email already exists');

    if (dto.ownerPhone) {
      const phoneExists = await this.prisma.user.findUnique({ where: { phone: dto.ownerPhone } });
      if (phoneExists) throw new ConflictException('A user with this phone number already exists');
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const owner = await this.prisma.user.create({
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

    const baseSlug = dto.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existingShop = await this.prisma.shop.count({ where: { slug: { startsWith: baseSlug } } });
    const shopSlug = existingShop > 0 ? `${baseSlug}-${existingShop + 1}` : baseSlug;

    let shopLat = dto.latitude;
    let shopLng = dto.longitude;
    if (!shopLat || !shopLng) {
      const geo = dto.address && dto.city && dto.state
        ? await geocodeAddress(dto.address, dto.city, dto.state)
        : null;
      if (geo) { shopLat = geo.latitude; shopLng = geo.longitude; }
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
        ownerId: owner.id,
        createdBy: owner.id,
        onboardedByAgentId: agent.id,
        onboardedAt: new Date(),
        ...(shopLat && shopLng && { latitude: shopLat, longitude: shopLng }),
      },
    });

    this.repo.incrementOnboardedShops(agent.id).catch((err: Error) =>
      this.logger.error(`Failed to increment shop count for agent ${agent.id}: ${err?.message}`),
    );

    const shopPortalUrl = this.configService.get<string>('app.shopPortalUrl', 'http://localhost:3003');
    this.emailService
      .send({
        to: dto.ownerEmail,
        subject: 'Welcome to PawGo — Your Shop Portal Credentials',
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
        this.logger.error(`Failed to send shop invite to ${dto.ownerEmail}: ${err?.message}`),
      );

    return { credentials: { email: dto.ownerEmail, temporaryPassword }, entity: shop };
  }
}
