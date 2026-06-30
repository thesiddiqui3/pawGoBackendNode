import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../../shared/email/email.module';
import { FieldAgentRepository } from './field-agent.repository';
import { FieldAgentsController } from './field-agents.controller';
import { FieldAgentsService } from './field-agents.service';

@Module({
  imports: [EmailModule, ConfigModule],
  controllers: [FieldAgentsController],
  providers: [FieldAgentsService, FieldAgentRepository],
  exports: [FieldAgentsService, FieldAgentRepository],
})
export class FieldAgentsModule {}
