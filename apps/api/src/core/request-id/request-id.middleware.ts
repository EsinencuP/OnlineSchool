import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { header, UUID } from '../http.js';
import type { HttpRequest, HttpResponse } from '../http.js';

export function ensureRequestId(req: HttpRequest, res: HttpResponse): string {
  const supplied = header(req, 'x-request-id');
  req.requestId ??= supplied && UUID.test(supplied) ? supplied.toLowerCase() : randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('Cache-Control', 'no-store');
  return req.requestId;
}
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: HttpRequest, res: HttpResponse, next: () => void): void {
    ensureRequestId(req, res);
    next();
  }
}
