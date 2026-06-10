import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { ApiResponseDto } from '../../common/dto';

interface HealthData {
  status: string;
  timestamp: string;
  environment: string;
  uptime: number;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Check API health status' })
  check(): ApiResponseDto<HealthData> {
    return ApiResponseDto.success<HealthData>(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? 'development',
        uptime: Math.floor(process.uptime()),
      },
      'PawGo API is healthy',
    );
  }
}
