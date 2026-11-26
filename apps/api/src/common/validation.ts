import { UnprocessableEntityException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export interface FieldError {
  field: string; // dotted path, e.g. "items.0.quantity"
  messages: string[];
}

/** Flattens nested class-validator errors into `[{ field, messages }]`. */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  const out: FieldError[] = [];
  for (const e of errors) {
    const field = parent ? `${parent}.${e.property}` : e.property;
    if (e.constraints) out.push({ field, messages: Object.values(e.constraints) });
    if (e.children?.length) out.push(...flattenValidationErrors(e.children, field));
  }
  return out;
}

/** Validation failures → 422 `{ error: { code: "VALIDATION_ERROR", message, details: [{ field, messages }] } }`. */
export function validationExceptionFactory(errors: ValidationError[]): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: flattenValidationErrors(errors),
  });
}
