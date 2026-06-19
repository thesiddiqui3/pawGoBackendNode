import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

import { UserRole } from '../../common/enums';
import { AssignmentsService } from './assignments.service';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { FailDeliveryDto } from './dto/fail-delivery.dto';

// ─── Delivery Partner assignment endpoints ────────────────────────────────────

@Controller({ path: 'delivery-partners/assignments', version: '1' })
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Get()
  @Roles(UserRole.DELIVERY_PARTNER)
  findMyAssignments(@CurrentUser() user: JwtPayload, @Query() query: AssignmentQueryDto) {
    return this.service.findMyAssignments(user.sub, query);
  }

  @Get(':id')
  @Roles(UserRole.DELIVERY_PARTNER, UserRole.SUPER_ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.sub, user.role);
  }

  @Patch(':id/accept')
  @Roles(UserRole.DELIVERY_PARTNER)
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.accept(id, user.sub);
  }

  @Patch(':id/pickup')
  @Roles(UserRole.DELIVERY_PARTNER)
  pickup(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.pickup(id, user.sub);
  }

  @Patch(':id/out-for-delivery')
  @Roles(UserRole.DELIVERY_PARTNER)
  startDelivery(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.startDelivery(id, user.sub);
  }

  @Patch(':id/delivered')
  @Roles(UserRole.DELIVERY_PARTNER)
  markDelivered(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markDelivered(id, user.sub);
  }

  @Patch(':id/failed')
  @Roles(UserRole.DELIVERY_PARTNER)
  markFailed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FailDeliveryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.markFailed(id, user.sub, dto);
  }

  @Patch(':id/reject')
  @Roles(UserRole.DELIVERY_PARTNER)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.rejectByPartner(id, user.sub);
  }
}

// ─── Admin assignment endpoints ───────────────────────────────────────────────

@Controller({ path: 'admin/delivery-assignments', version: '1' })
export class AdminAssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Query() query: AssignmentQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
}
