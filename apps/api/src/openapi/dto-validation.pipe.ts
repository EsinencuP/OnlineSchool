import { Injectable } from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validateSync } from 'class-validator';
import type { ValidationError } from 'class-validator';
import { domainError, fail } from '../core/errors/domain-error.js';
const fields = (errors: ValidationError[]): string[] =>
  errors.flatMap((e) => [e.property, ...fields(e.children ?? [])]);

@Injectable()
export class DtoValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const type = metadata.metatype;
    if (metadata.type !== 'body' || !type) return value;
    // Empty command bodies and conditional business rules are also checked by
    // their command handlers; no conversion or stripping changes the hashed body.
    if (!getMetadataStorage().getTargetValidationMetadatas(type, '', false, false).length)
      return value;
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return fail(domainError('INVALID_INPUT', 400));
    const errors = validateSync(plainToInstance(type, value), {
      whitelist: false,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    });
    if (!errors.length) return value;
    const invalid = fields(errors);
    const code = invalid.some((f) => ['amount', 'exceptionAmount'].includes(f))
      ? 'INVALID_MONEY'
      : invalid.includes('currency')
        ? 'INVALID_CURRENCY'
        : 'INVALID_INPUT';
    return fail({
      ...domainError(code, code === 'INVALID_INPUT' ? 400 : 422),
      details: { fields: [...new Set(invalid)] },
    });
  }
}
