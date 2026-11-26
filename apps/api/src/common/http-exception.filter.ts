import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

/** Maps every thrown error to `{ error: { code, message, details? } }`. Unknown errors are logged, never leaked. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const { status, body } = this.toBody(exception);
    body.error.requestId = req.id;

    if (status >= 500) {
      this.logger.error(
        `[${req.id ?? '-'}] ${req.method} ${req.originalUrl} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    res.status(status).json(body);
  }

  private toBody(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      let message = exception.message;
      let details: unknown;
      let code = STATUS_CODES[status] ?? `HTTP_${status}`;
      if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;
        if (Array.isArray(r.message)) {
          message = 'Validation failed';
          details = r.message;
          code = 'VALIDATION_ERROR';
        } else if (typeof r.message === 'string') {
          message = r.message;
        }
        if (typeof r.code === 'string') code = r.code;
        if (r.details !== undefined) details = r.details;
      }
      return { status, body: { error: { code, message, ...(details !== undefined && { details }) } } };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: { error: { code: 'UNIQUE_CONSTRAINT', message: 'Resource already exists', details: exception.meta } },
        };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, body: { error: { code: 'NOT_FOUND', message: 'Resource not found' } } };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    };
  }
}
