import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';
import { writeGenerated } from '../../../scripts/write-generated.mjs';
const input = new URL('../openapi/openapi.json', import.meta.url);
const changed = await writeGenerated(
  new URL('../src/generated/openapi.ts', import.meta.url),
  COMMENT_HEADER + astToString(await openapiTS(input)),
);
console.log(`OpenAPI TypeScript: ${changed ? 'updated' : 'unchanged'}`);
