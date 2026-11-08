import { Injectable } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DomainError } from './domain-error.js';

export class ManagerContactsDto {
  @ApiProperty() whatsapp!: string;
  @ApiProperty() telegram!: string;
}
export class ProblemDetails {
  @ApiProperty() type!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: number;
  @ApiProperty() detail!: string;
  @ApiProperty() instance!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiPropertyOptional({ type: ManagerContactsDto }) managerContacts?: ManagerContactsDto;
}
@Injectable()
export class ErrorMapper {
  toProblemDetails(error: DomainError, path: string, requestId: string): ProblemDetails {
    const titles: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      402: 'Payment Required',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      503: 'Service Unavailable',
    };
    const contacts =
      error.code === 'ACCESS_SUSPENDED'
        ? (error.details?.managerContacts as ManagerContactsDto | undefined)
        : undefined;
    return {
      type: `urn:online-school:error:${error.code.toLowerCase().replaceAll('_', '-')}`,
      title: titles[error.status] ?? 'Request Failed',
      status: error.status,
      detail: error.message,
      instance: path.split('?')[0] ?? path,
      code: error.code,
      requestId,
      ...(contacts
        ? { managerContacts: { whatsapp: contacts.whatsapp, telegram: contacts.telegram } }
        : {}),
    };
  }
}
