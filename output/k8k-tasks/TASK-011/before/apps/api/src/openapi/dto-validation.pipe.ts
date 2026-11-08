import { Injectable } from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validateSync } from 'class-validator';
import type { ValidationError } from 'class-validator';
import { domainError, fail } from '../core/errors/domain-error.js';
const fields = (errors: ValidationError[]): string[] =>
  errors.flatMap((e) => [e.property, ...fields(e.children ?? [])]);
export const STRICT_INPUT_DTO = 'core.strictInputDto';

@Injectable()
export class DtoValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const type = metadata.metatype;
    if (!type) return value;
    const strict = Reflect.getMetadata(STRICT_INPUT_DTO, type) === true;
    if (metadata.type !== 'body' && !(strict && metadata.type === 'query')) return value;
    // Empty command bodies and conditional business rules are also checked by
    // their command handlers; no conversion or stripping changes the hashed body.
    if (!getMetadataStorage().getTargetValidationMetadatas(type, '', false, false).length) {
      if (!strict) return value;
      if (
        value === undefined ||
        (value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          Object.keys(value).length === 0)
      )
        return plainToInstance(type, {});
      return fail(domainError('INVALID_INPUT', 422));
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return fail(domainError('INVALID_INPUT', strict ? 422 : 400));
    const instance = plainToInstance(type, value);
    const errors = validateSync(instance, {
      whitelist: strict,
      forbidNonWhitelisted: strict,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    });
    if (!errors.length) return strict ? instance : value;
    const invalid = fields(errors);
    const code = errors.some(e=>Object.values(e.constraints??{}).includes('INVALID_MEET_LINK'))
      ? 'INVALID_MEET_LINK'
      : invalid.some((f) => ['amount', 'exceptionAmount'].includes(f))
      ? 'INVALID_MONEY'
      : invalid.includes('currency')
        ? 'INVALID_CURRENCY'
        : 'INVALID_INPUT';
    return fail({
      ...domainError(code, strict || code !== 'INVALID_INPUT' ? 422 : 400),
      details: { fields: [...new Set(invalid)] },
    });
  }
}
