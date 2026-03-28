import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as jwt from 'jsonwebtoken';
import { Log, LogDocument } from '../../logs/logs.schema';

@Injectable()
export class LogInterceptor implements NestInterceptor {
  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap((responseBody) => {
        const response = context.switchToHttp().getResponse();
        const statusCode: number = response.statusCode;
        const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        const source = request.url.startsWith('/logs') ? 'internal' : 'external';

        const token: string | undefined = request.cookies?.jwt;
        const decoded = token
          ? (jwt.decode(token) as { sub?: string; email?: string } | null)
          : null;

        this.logModel.create({
          method: request.method,
          url: request.url,
          statusCode,
          responseTime: Date.now() - start,
          requestBody: request.body || null,
          requestHeaders: request.headers,
          responseBody: responseBody || null,
          ipAddress: request.ip || 'unknown',
          userAgent: request.headers['user-agent'] || 'unknown',
          timestamp: new Date(),
          level,
          source,
          userId: decoded?.sub ?? null,
          userEmail: decoded?.email ?? null,
        }).catch(() => {});
      }),
    );
  }
}
