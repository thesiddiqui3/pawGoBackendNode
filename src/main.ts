import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppLogger } from './shared/logger/logger.service';
import { setupSwagger } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(AppLogger);

  app.useLogger(logger);

  // Disable ETags so browsers never get 304 cached responses for API calls
  app.getHttpAdapter().getInstance().set('etag', false);

  const port = configService.get<number>('app.port', 3000);
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  const frontendUrl = configService.get<string>('app.frontendUrl', '*');

  // Security
  app.use(helmet());
  const devOrigins = [
    'http://localhost:5173',  // pet owner / admin panel
    'http://localhost:5174',  // clinic panel
    'http://localhost:5175',  // shop panel
    'http://localhost:5176',  // clinic panel (alt port)
    'http://localhost:5177',
    'http://localhost:3000',
    'http://localhost:4173',
    'http://localhost:4174',
    'http://localhost:4175',
    'http://localhost:4176',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:5176',
    'http://127.0.0.1:5177',
  ];
  app.enableCors({
    origin: nodeEnv === 'production' ? frontendUrl : devOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    credentials: true,
  });

  // Compression
  app.use(compression());

  // Global API prefix
  app.setGlobalPrefix('api');

  // API versioning (URL-based: /api/v1/...)
  app.enableVersioning({ type: VersioningType.URI });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger (disabled in production)
  if (nodeEnv !== 'production') {
    setupSwagger(app);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`🐾 PawGo API running on port ${port} [${nodeEnv}]`, 'Bootstrap');
  if (nodeEnv !== 'production') {
    logger.log(
      `📚 Swagger docs: http://localhost:${port}/api/docs`,
      'Bootstrap',
    );
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
