import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeliveryStatus } from '@prisma/client';
import { DeliveryEvent, DeliveryAssignmentEventPayload } from '../../common/events/delivery.events';
import { UserRole } from '../../common/enums';
import { DeliveryPartnerRepository } from '../delivery-partners/delivery-partner.repository';
import { AssignmentRepository } from './assignment.repository';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { FailDeliveryDto } from './dto/fail-delivery.dto';

// Valid status machine transitions for delivery
const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.ACCEPTED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.ACCEPTED]: [DeliveryStatus.PICKED_UP, DeliveryStatus.CANCELLED],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.OUT_FOR_DELIVERY],
  [DeliveryStatus.OUT_FOR_DELIVERY]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.FAILED]: [],
  [DeliveryStatus.CANCELLED]: [],
};

const STATUS_TO_EVENT: Partial<Record<DeliveryStatus, DeliveryEvent>> = {
  [DeliveryStatus.ACCEPTED]: DeliveryEvent.ACCEPTED,
  [DeliveryStatus.PICKED_UP]: DeliveryEvent.PICKED_UP,
  [DeliveryStatus.OUT_FOR_DELIVERY]: DeliveryEvent.STARTED,
  [DeliveryStatus.DELIVERED]: DeliveryEvent.COMPLETED,
  [DeliveryStatus.FAILED]: DeliveryEvent.FAILED,
};

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    private readonly assignmentRepository: AssignmentRepository,
    private readonly partnerRepository: DeliveryPartnerRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Admin: create manual assignment ──────────────────────────────────────

  async create(dto: CreateAssignmentDto, adminId: string) {
    const alreadyAssigned = await this.assignmentRepository.existsByOrderId(dto.orderId);
    if (alreadyAssigned) throw new ConflictException('Order is already assigned to a delivery partner');

    const partner = await this.partnerRepository.findById(dto.deliveryPartnerId);
    if (!partner) throw new NotFoundException('Delivery partner not found');
    if (!partner.isApproved) throw new BadRequestException('Delivery partner is not approved');

    const assignment = await this.assignmentRepository.create({
      order: { connect: { id: dto.orderId } },
      deliveryPartner: { connect: { id: dto.deliveryPartnerId } },
      assignedBy: adminId,
    });

    this.emitSimpleEvent(DeliveryEvent.ASSIGNED, {
      assignmentId: assignment.id,
      orderId: assignment.orderId,
      deliveryPartnerId: assignment.deliveryPartnerId,
      status: assignment.status,
    });
    this.logger.log(`Assignment created: order ${dto.orderId} → partner ${dto.deliveryPartnerId}`);
    return assignment;
  }

  // ─── Partner: list own assignments ────────────────────────────────────────

  async findMyAssignments(partnerId: string, query: AssignmentQueryDto) {
    return this.buildQuery({ deliveryPartnerId: partnerId }, query);
  }

  async findOne(id: string, requesterId: string, requesterRole: string) {
    const assignment = await this.assignmentRepository.findById(id);
    if (!assignment) throw new NotFoundException('Assignment not found');
    this.assertReadAccess(assignment, requesterId, requesterRole);
    return assignment;
  }

  // ─── Partner: status transitions ──────────────────────────────────────────

  async accept(id: string, partnerId: string) {
    const assignment = await this.getAndAssertPartner(id, partnerId);
    const partner = await this.partnerRepository.findById(partnerId);
    if (!partner?.isOnline) throw new BadRequestException('You must be online to accept assignments');
    return this.transition(assignment, DeliveryStatus.ACCEPTED, { acceptedAt: new Date() });
  }

  async pickup(id: string, partnerId: string) {
    const assignment = await this.getAndAssertPartner(id, partnerId);
    return this.transition(assignment, DeliveryStatus.PICKED_UP, { pickedUpAt: new Date() });
  }

  async startDelivery(id: string, partnerId: string) {
    const assignment = await this.getAndAssertPartner(id, partnerId);
    return this.transition(assignment, DeliveryStatus.OUT_FOR_DELIVERY, { outForDeliveryAt: new Date() });
  }

  async markDelivered(id: string, partnerId: string) {
    const assignment = await this.getAndAssertPartner(id, partnerId);
    const updated = await this.transition(assignment, DeliveryStatus.DELIVERED, { deliveredAt: new Date() });
    // Increment partner's delivery count (earnings recorded by EarningService on this event)
    await this.partnerRepository.incrementDeliveries(partnerId, 0); // earnings via event
    return updated;
  }

  async markFailed(id: string, partnerId: string, dto: FailDeliveryDto) {
    const assignment = await this.getAndAssertPartner(id, partnerId);
    return this.transition(assignment, DeliveryStatus.FAILED, {
      failedAt: new Date(),
      failureReason: dto.reason,
    });
  }

  // ─── Admin: find all assignments ──────────────────────────────────────────

  async findAll(query: AssignmentQueryDto) {
    return this.buildQuery({}, query);
  }

  // ─── Live tracking (called from TrackingService / orders endpoint) ─────────

  async findByOrderId(orderId: string) {
    const assignment = await this.assignmentRepository.findByOrderId(orderId);
    if (!assignment) throw new NotFoundException('No delivery assignment for this order');
    return assignment;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getAndAssertPartner(assignmentId: string, partnerId: string) {
    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.deliveryPartnerId !== partnerId) {
      throw new ForbiddenException('You are not assigned to this order');
    }
    return assignment;
  }

  private async transition(
    assignment: Awaited<ReturnType<AssignmentRepository['findById']>>,
    newStatus: DeliveryStatus,
    extra: Record<string, unknown> = {},
  ) {
    if (!assignment) throw new NotFoundException('Assignment not found');
    const allowed = DELIVERY_TRANSITIONS[assignment.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${assignment.status} to ${newStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }
    const updated = await this.assignmentRepository.updateStatus(assignment.id, newStatus, extra as any);
    const event = STATUS_TO_EVENT[newStatus];
    if (event) this.emitEvent(event, updated);
    return updated;
  }

  private assertReadAccess(assignment: NonNullable<Awaited<ReturnType<AssignmentRepository['findById']>>>, requesterId: string, role: string) {
    const isAdmin = role === UserRole.SUPER_ADMIN;
    if (isAdmin) return;
    if (assignment.deliveryPartnerId === requesterId) return;
    throw new ForbiddenException('Access denied');
  }

  private async buildQuery(baseWhere: Record<string, unknown>, query: AssignmentQueryDto) {
    const where: Record<string, unknown> = { ...baseWhere };
    if (query.status) where['status'] = query.status;
    if (query.date) {
      const [y, m, d] = query.date.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, d));
      where['assignedAt'] = { gte: start, lt: new Date(start.getTime() + 86_400_000) };
    }
    return this.assignmentRepository.findMany(where, query);
  }

  private emitEvent(event: DeliveryEvent, assignment: NonNullable<Awaited<ReturnType<AssignmentRepository['findById']>>>) {
    if (!assignment) return;
    this.emitSimpleEvent(event, {
      assignmentId: assignment.id,
      orderId: assignment.orderId,
      deliveryPartnerId: assignment.deliveryPartnerId,
      status: assignment.status,
    });
  }

  private emitSimpleEvent(event: DeliveryEvent, payload: DeliveryAssignmentEventPayload) {
    this.eventEmitter.emit(event, payload);
  }
}
