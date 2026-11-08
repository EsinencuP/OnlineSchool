import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RequestIdMiddleware } from '../core/request-id/request-id.middleware.js';
import type { HttpRequest, HttpResponse } from '../core/http.js';
import { DTO_CLASSES, SCHEMA_ADDITIONAL_PROPERTIES, SCHEMA_OVERRIDES } from './dtos.js';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('OnlineSchool API')
    .setVersion('v1')
    .setOpenAPIVersion('3.1.0')
    .setDescription(
      'Business commands with server-side sessions, MFA, CSRF and transactional idempotency. Money is a decimal string.',
    )
    .addCookieAuth('__Host-school_session', { type: 'apiKey', in: 'cookie' }, 'sessionCookie')
    .build();
  const document = SwaggerModule.createDocument(app, config, { extraModels: DTO_CLASSES });
  const schemas = document.components!.schemas!;
  for (const [name, additionalProperties] of Object.entries(SCHEMA_ADDITIONAL_PROPERTIES)) {
    const schema = schemas[name];
    if (schema && !('$ref' in schema)) schema.additionalProperties = additionalProperties;
  }
  // Discriminated unions and primitive money aliases supplement model metadata;
  // all object fields remain decorated DTO classes.
  for (const [name, schema] of Object.entries(SCHEMA_OVERRIDES))
    schemas[name] = schema as (typeof schemas)[string];
  document.paths = Object.fromEntries(
    Object.entries(document.paths).sort(([a], [b]) => a.localeCompare(b)),
  );
  document.components!.schemas = Object.fromEntries(
    Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b)),
  );
  return document;
}

export function setupSwagger(app: INestApplication): void {
  const requestId = app.get(RequestIdMiddleware);
  // Swagger registers adapter routes before Nest's normal route middleware.
  app.use((req: HttpRequest, res: HttpResponse, next: () => void) => {
    if (req.url?.startsWith('/api/docs')) requestId.use(req, res, next);
    else next();
  });
  SwaggerModule.setup('api/docs', app, createOpenApiDocument(app), {
    jsonDocumentUrl: '/api/docs-json',
    raw: ['json'],
    swaggerOptions: { persistAuthorization: false },
  });
}
