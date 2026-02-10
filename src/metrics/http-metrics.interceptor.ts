import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { env } from '../config/env';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    if (!env.METRICS_ENABLED) {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const start = Date.now();
    const method = (req.method || 'GET').toUpperCase();
    const route =
      (req.route && req.route.path) ||
      (req as any).originalUrl ||
      (req.path as string) ||
      'unknown';

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        const status = res.statusCode || 0;

        this.metrics.httpRequestsTotal.inc({
          method,
          route,
          status: String(status),
        });

        this.metrics.httpRequestDurationMs.observe(
          { method, route },
          durationMs,
        );
      }),
    );
  }
}

