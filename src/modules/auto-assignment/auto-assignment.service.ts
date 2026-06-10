import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeliveryPartner } from '@prisma/client';
import { DeliveryPartnerRepository } from '../delivery-partners/delivery-partner.repository';
import { AssignmentsService } from '../delivery-assignments/assignments.service';

@Injectable()
export class AutoAssignmentService {
  private readonly logger = new Logger(AutoAssignmentService.name);

  constructor(
    private readonly partnerRepository: DeliveryPartnerRepository,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  /**
   * Find the nearest available, approved, online delivery partner to the given
   * coordinates and assign the order to them automatically.
   */
  async autoAssign(orderId: string, shopLat: number, shopLng: number, adminId: string) {
    const candidates = await this.partnerRepository.findAvailablePartners();

    if (candidates.length === 0) {
      throw new NotFoundException('No available delivery partners at this time');
    }

    // Sort by Haversine distance to the shop
    const sorted = candidates
      .filter((p) => p.currentLat !== null && p.currentLng !== null)
      .map((p) => ({
        partner: p,
        distance: this.haversineKm(shopLat, shopLng, p.currentLat!, p.currentLng!),
      }))
      .sort((a, b) => a.distance - b.distance);

    if (sorted.length === 0) {
      // Fall back to any available partner (no location data)
      const fallback = candidates[0];
      return this.assignToPartner(orderId, fallback, adminId);
    }

    return this.assignToPartner(orderId, sorted[0].partner, adminId);
  }

  private async assignToPartner(orderId: string, partner: DeliveryPartner, adminId: string) {
    const assignment = await this.assignmentsService.create(
      { orderId, deliveryPartnerId: partner.id },
      adminId,
    );
    this.logger.log(`Auto-assigned order ${orderId} to partner ${partner.id}`);
    return assignment;
  }

  /** Haversine formula — returns distance in kilometres */
  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
