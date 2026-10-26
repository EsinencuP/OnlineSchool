import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { createOpenApiDocument } from '../dist/openapi/swagger.js';
const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
try {
  const doc = createOpenApiDocument(app);
  await writeFile(
    new URL('../../../packages/api-contracts/openapi/openapi.json', import.meta.url),
    JSON.stringify(doc, null, 2) + '\n',
  );
  console.log(
    `OpenAPI ${doc.openapi}, ${Object.values(doc.paths).reduce((n, p) => n + Object.keys(p).filter((k) => ['get', 'post', 'delete', 'patch', 'put'].includes(k)).length, 0)} business operations exported.`,
  );
} finally {
  await app.close();
}
