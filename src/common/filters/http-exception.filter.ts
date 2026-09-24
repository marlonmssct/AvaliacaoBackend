import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Erro interno no servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        message = (res as any).message || exception.message;
        error = (res as any).error || exception.name;
      } else {
        message = res;
        error = exception.name;
      }
    }

    // Tratamento para conflitos do Prisma (ex: P2002 Unique Constraint) se escaparem
    if ((exception as any)?.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      const target = (exception as any)?.meta?.target;
      message = `Conflito de unicidade no banco de dados. Campo(s): ${Array.isArray(target) ? target.join(', ') : target}`;
      error = 'Conflict';
    }

    if ((exception as any)?.code === 'P2003') {
      status = HttpStatus.CONFLICT;
      message = 'Este recurso possui registros relacionados e não pode ser excluído.';
      error = 'Conflict';
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status ${status} - Error: ${exception instanceof Error ? exception.message : JSON.stringify(exception)}`,
        exception instanceof Error ? exception.stack : '',
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status ${status} (${error}) - Message: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
    });
  }
}
