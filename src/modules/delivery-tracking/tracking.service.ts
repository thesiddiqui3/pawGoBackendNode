import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeliveryEvent } from '../../common/events/delivery.events';
import { DeliveryPartnerRepository } from '../delivery-partners/delivery-partner.repository';
import { AssignmentsService } from '../delivery-assignments/assignments.service';
import { LocationRepository } from './location.repository';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly partnerRepository: DeliveryPartnerRepository,
    private readonly assignmentsService: AssignmentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async updateLocation(partnerId: string, dto: UpdateLocationDto) {
    const partner = await this.partnerRepository.findById(partnerId);
    if (!partner) throw new NotFoundException('Delivery partner not found');

    // Persist location log and update current position on the partner record
    const [locationUpdate] = await Promise.all([
      this.locationRepository.create({
        deliveryPartnerId: partner.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
      }),
      this.partnerRepository.update(partner.id, {
        currentLat: dto.latitude,
        currentLng: dto.longitude,
        locationUpdatedAt: new Date(),
      }),
    ]);

    this.eventEmitter.emit(DeliveryEvent.LOCATION_UPDATED, {
      deliveryPartnerId: partner.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timestamp: locationUpdate.timestamp,
    });

    return locationUpdate;
  }

  async getLiveTracking(orderId: string) {
    const assignment = await this.assignmentsService.findByOrderId(orderId);
    const partner = await this.partnerRepository.findById(assignment.deliveryPartnerId);
    if (!partner) throw new NotFoundException('Delivery partner not found');

    const latestLocation = await this.locationRepository.findLatestByPartner(partner.id);

    return {
      partner: {
        id: partner.id,
        name: `${(partner as any).user.firstName} ${(partner as any).user.lastName}`,
        phone: (partner as any).user.phone,
        vehicleType: partner.vehicleType,
        vehicleNumber: partner.vehicleNumber,
      },
      location: latestLocation
        ? { lat: latestLocation.latitude, lng: latestLocation.longitude, updatedAt: latestLocation.timestamp }
        : null,
      status: assignment.status,
      assignedAt: assignment.assignedAt,
      acceptedAt: assignment.acceptedAt,
      pickedUpAt: assignment.pickedUpAt,
      estimatedDelivery: null,
    };
  }
}
