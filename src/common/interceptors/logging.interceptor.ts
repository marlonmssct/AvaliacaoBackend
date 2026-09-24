import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl, ip } = request;
    const user = (request as any).user;
    const userId = user?.id ? `[User: ${user.id} (${user.role})]` : '[Anonymous]';

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = response.statusCode;
          const duration = Date.now() - now;
          this.logger.log(
            `SUCCESS: ${method} ${originalUrl} ${statusCode} - ${duration}ms ${userId} - IP: ${ip}`,
          );
        },
        error: (error) => {
          const duration = Date.now() - now;
          const status = error?.status || 500;
          this.logger.warn(
            `FAILED: ${method} ${originalUrl} ${status} - ${duration}ms ${userId} - IP: ${ip} - Message: ${error?.message}`,
          );
        },
      }),
    );
  }
}
