import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/** Handlers may return `Paginated` to attach `meta`; anything else is wrapped as `{ data }`. */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: { page: number; pageSize: number; total: number; totalPages?: number },
  ) {}
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof Paginated) return { data: value.items, meta: value.meta };
        return { data: value ?? null };
      }),
    );
  }
}
