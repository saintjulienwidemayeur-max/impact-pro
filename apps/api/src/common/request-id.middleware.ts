import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');
const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Assigns a request id (reusing a safe inbound `x-request-id`), echoes it, and logs one line per request. */
export function requestIdMiddleware(req: Request & { id?: string }, res: Response, next: NextFunction): void {
  const inbound = req.header('x-request-id');
  req.id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader('x-request-id', req.id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.log(`[${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
}
