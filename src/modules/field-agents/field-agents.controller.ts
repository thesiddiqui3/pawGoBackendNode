import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { FieldAgentsService, AgentOnboardClinicDto, AgentOnboardShopDto } from './field-agents.service';
import { CreateFieldAgentDto } from './dto/create-field-agent.dto';
import { UpdateFieldAgentDto, SuspendFieldAgentDto } from './dto/update-field-agent.dto';

@ApiTags('Field Agents')
@ApiBearerAuth()
@Controller({ path: 'field-agents', version: '1' })
export class FieldAgentsController {
  constructor(private readonly service: FieldAgentsService) {}

  // ── Admin: create an agent ─────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new field agent (admin only)' })
  create(@Body() dto: CreateFieldAgentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  // ── Admin: list all agents ────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all field agents (admin only)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'assignedCity', required: false })
  @ApiQuery({ name: 'assignedState', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('assignedCity') assignedCity?: string,
    @Query('assignedState') assignedState?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.findAll({
      search,
      assignedCity,
      assignedState,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  // ── Agent: onboard a clinic ───────────────────────────────────────────────
  @Post('onboard/clinic')
  @Roles(UserRole.FIELD_AGENT)
  @ApiOperation({ summary: 'Onboard a new clinic (field agent only)' })
  onboardClinic(@Body() dto: AgentOnboardClinicDto, @CurrentUser() user: JwtPayload) {
    return this.service.onboardClinic(user.sub, dto);
  }

  // ── Agent: onboard a shop ─────────────────────────────────────────────────
  @Post('onboard/shop')
  @Roles(UserRole.FIELD_AGENT)
  @ApiOperation({ summary: 'Onboard a new shop (field agent only)' })
  onboardShop(@Body() dto: AgentOnboardShopDto, @CurrentUser() user: JwtPayload) {
    return this.service.onboardShop(user.sub, dto);
  }

  // ── Agent: get own profile ────────────────────────────────────────────────
  @Get('me')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FIELD_AGENT)
  @ApiOperation({ summary: 'Get current field agent profile' })
  findMe(@CurrentUser() user: JwtPayload) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return { message: 'Super admins do not have a field agent profile' };
    }
    return this.service.findMe(user.sub);
  }

  // ── Agent: my onboarded clinics ───────────────────────────────────────────
  @Get('me/clinics')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FIELD_AGENT)
  @ApiOperation({ summary: 'Get clinics onboarded by the current agent' })
  myClinicds(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.findMe(user.sub).then(agent =>
      this.service.getOnboardedClinics(agent.id, parseInt(page, 10), parseInt(limit, 10)),
    );
  }

  // ── Agent: my onboarded shops ─────────────────────────────────────────────
  @Get('me/shops')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FIELD_AGENT)
  @ApiOperation({ summary: 'Get shops onboarded by the current agent' })
  myShops(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.findMe(user.sub).then(agent =>
      this.service.getOnboardedShops(agent.id, parseInt(page, 10), parseInt(limit, 10)),
    );
  }

  // ── Admin: get agent by ID ────────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a field agent by ID (admin only)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // ── Admin: update agent ───────────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update field agent settings (admin only)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFieldAgentDto) {
    return this.service.update(id, dto);
  }

  // ── Admin: suspend agent ──────────────────────────────────────────────────
  @Patch(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspend a field agent (admin only)' })
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendFieldAgentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.suspend(id, user.sub, dto);
  }

  // ── Admin: activate agent ─────────────────────────────────────────────────
  @Patch(':id/activate')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate a suspended field agent (admin only)' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.activate(id);
  }

  // ── Admin: agent's onboarded clinics ─────────────────────────────────────
  @Get(':id/clinics')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Get clinics onboarded by an agent (admin only)" })
  agentClinics(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.getOnboardedClinics(id, parseInt(page, 10), parseInt(limit, 10));
  }

  // ── Admin: agent's onboarded shops ───────────────────────────────────────
  @Get(':id/shops')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Get shops onboarded by an agent (admin only)" })
  agentShops(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.getOnboardedShops(id, parseInt(page, 10), parseInt(limit, 10));
  }
}
