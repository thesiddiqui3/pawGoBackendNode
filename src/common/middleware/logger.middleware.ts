import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

function shouldLogBody(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.LOG_RESPONSE === 'true';
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') ?? '';
    const start = Date.now();

    res.setHeader('Cache-Control', 'no-store');

    if (shouldLogBody()) {
      const chunks: Buffer[] = [];
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);

      res.write = (chunk: any, ...rest: any[]): boolean => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return (originalWrite as any)(chunk, ...rest);
      };

      res.end = (chunk?: any, ...rest: any[]): Response => {
        if (chunk && chunk !== '') {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const resBody = Buffer.concat(chunks).toString('utf8');
        const { statusCode } = res;
        const duration = Date.now() - start;

        const query = Object.keys(req.query).length ? req.query : null;
        const reqBody = req.body && Object.keys(req.body).length ? req.body : null;

        this.logger.log(`${method} ${originalUrl} ${statusCode} ${duration}ms`);
        if (query) this.logger.log(`Query:    ${JSON.stringify(query)}`);
        if (reqBody) this.logger.log(`Body:     ${JSON.stringify(reqBody)}`);
        try {
          const parsed = JSON.parse(resBody);
          this.logger.log(`Response: ${JSON.stringify(parsed, null, 2)}`);
        } catch {
          if (resBody) this.logger.log(`Response: ${resBody.slice(0, 500)}`);
        }

        return (originalEnd as any)(chunk, ...rest);
      };
    } else {
      res.on('finish', () => {
        const { statusCode } = res;
        const duration = Date.now() - start;
        const contentLength = res.get('content-length');
        this.logger.log(
          `${method} ${originalUrl} ${statusCode} ${duration}ms ${contentLength ?? 0}b - ${ip} ${userAgent}`,
        );
      });
    }

    next();
  }
}
