import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

@Injectable()
export class AppLogger extends ConsoleLogger {
  constructor() {
    super();
    const isDev = process.env.NODE_ENV !== 'production';
    const levels: LogLevel[] = isDev
      ? ['log', 'error', 'warn', 'debug', 'verbose']
      : ['log', 'error', 'warn'];
    this.setLogLevels(levels);
  }

  log(message: string, context?: string): void {
    super.log(message, context);
  }

  error(message: string, stack?: string, context?: string): void {
    super.error(message, stack, context);
  }

  warn(message: string, context?: string): void {
    super.warn(message, context);
  }

  debug(message: string, context?: string): void {
    super.debug(message, context);
  }

  verbose(message: string, context?: string): void {
    super.verbose(message, context);
  }
}
