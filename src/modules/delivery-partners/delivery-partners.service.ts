import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeliveryEvent } from '../../common/events/delivery.events';
import { UserRole } from '../../common/enums';
import { DeliveryPartnerRepository } from './delivery-partner.repository';
import { DeliveryPartnerQueryDto } from './dto/delivery-partner-query.dto';
import { RegisterDeliveryPartnerDto } from './dto/register-delivery-partner.dto';
import { ToggleOnlineDto } from './dto/toggle-online.dto';
import { UpdateDeliveryPartnerDto } from './dto/update-delivery-partner.dto';

@Injectable()
export class DeliveryPartnersService {
  private readonly logger = new Logger(DeliveryPartnersService.name);

  constructor(
    private readonly partnerRepository: DeliveryPartnerRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Registration ─────────────────────────────────────────────────────────

  async register(userId: string, dto: RegisterDeliveryPartnerDto) {
    const exists = await this.partnerRepository.existsByUserId(userId);
    if (exists) throw new ConflictException('Delivery partner profile already exists');

    return this.partnerRepository.create({
      user: { connect: { id: userId } },
      vehicleType: dto.vehicleType,
      vehicleNumber: dto.vehicleNumber,
      drivingLicense: dto.drivingLicense,
      aadhaarNumber: dto.aadhaarNumber,
      emergencyContact: dto.emergencyContact,
      profilePhoto: dto.profilePhoto,
      createdBy: userId,
    });
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getMyProfile(userId: string) {
    const partner = await this.partnerRepository.findByUserId(userId);
    if (!partner) throw new NotFoundException('Delivery partner profile not found');
    return partner;
  }

  async updateProfile(userId: string, dto: UpdateDeliveryPartnerDto) {
    const partner = await this.partnerRepository.findByUserId(userId);
    if (!partner) throw new NotFoundException('Delivery partner profile not found');
    return this.partnerRepository.update(partner.id, { ...dto });
  }

  // ─── Online / Availability toggles ───────────────────────────────────────

  async toggleOnline(userId: string, dto: ToggleOnlineDto) {
    const partner = await this.partnerRepository.findByUserId(userId);
    if (!partner) throw new NotFoundException('Delivery partner profile not found');
    if (!partner.isApproved) throw new ForbiddenException('Your account is pending approval');

    const updated = await this.partnerRepository.update(partner.id, { isOnline: dto.isOnline });
    const event = dto.isOnline ? DeliveryEvent.PARTNER_ONLINE : DeliveryEvent.PARTNER_OFFLINE;
    this.eventEmitter.emit(event, { deliveryPartnerId: partner.id });
    this.logger.log(`Partner ${partner.id} is now ${dto.isOnline ? 'online' : 'offline'}`);
    return updated;
  }

  async toggleAvailability(userId: string) {
    const partner = await this.partnerRepository.findByUserId(userId);
    if (!partner) throw new NotFoundException('Delivery partner profile not found');
    return this.partnerRepository.update(partner.id, { isAvailable: !partner.isAvailable });
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard(userId: string) {
    const partner = await this.partnerRepository.findByUserId(userId);
    if (!partner) throw new NotFoundException('Delivery partner profile not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayDeliveries, pendingDeliveries, todayEarnings] = await Promise.all([
      this.countTodayDeliveries(partner.id, today),
      this.countPendingDeliveries(partner.id),
      this.sumTodayEarnings(partner.id, today),
    ]);

    return {
      todayDeliveries,
      pendingDeliveries,
      earningsToday: todayEarnings,
      averageRating: partner.averageRating,
      totalDeliveries: partner.totalDeliveries,
      totalEarnings: partner.totalEarnings,
      isOnline: partner.isOnline,
      isAvailable: partner.isAvailable,
    };
  }

  private async countTodayDeliveries(_partnerId: string, _from: Date): Promise<number> {
    return 0; // Populated by EarningsService event listener
  }

  private async countPendingDeliveries(_partnerId: string): Promise<number> {
    return 0;
  }

  private async sumTodayEarnings(_partnerId: string, _from: Date): Promise<number> {
    return 0;
  }

  // ─── Admin operations ─────────────────────────────────────────────────────

  async findAll(query: DeliveryPartnerQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.approved !== undefined) where['isApproved'] = query.approved;
    if (query.online !== undefined) where['isOnline'] = query.online;
    if (query.available !== undefined) where['isAvailable'] = query.available;
    return this.partnerRepository.findMany(where, query);
  }

  async approve(id: string, adminId: string) {
    const partner = await this.partnerRepository.findById(id);
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return this.partnerRepository.update(id, {
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: adminId,
    });
  }

  async suspend(id: string, adminId: string, reason?: string) {
    const partner = await this.partnerRepository.findById(id);
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return this.partnerRepository.update(id, {
      isApproved: false,
      isOnline: false,
      isAvailable: false,
      suspendedAt: new Date(),
      suspendedBy: adminId,
      suspendReason: reason,
    });
  }

  async getAdminDashboard() {
    const [total, active, online] = await Promise.all([
      this.partnerRepository.findMany({}, { page: 1, limit: 1 }),
      this.partnerRepository.findMany({ isApproved: true }, { page: 1, limit: 1 }),
      this.partnerRepository.findMany({ isOnline: true }, { page: 1, limit: 1 }),
    ]);
    return {
      totalPartners: total.total,
      activePartners: active.total,
      onlinePartners: online.total,
    };
  }

  async assertRole(userId: string, role: string): Promise<void> {
    if (role !== UserRole.DELIVERY_PARTNER) return;
    const partner = await this.partnerRepository.findByUserId(userId);
    if (!partner) throw new NotFoundException('Delivery partner profile not found');
  }
}
