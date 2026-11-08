// Used only as NODE_OPTIONS preload during the standard OpenAPI export command.
import '../../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { DatabaseService } from '../../../apps/api/dist/core/database/database.module.js';
Object.defineProperty(DatabaseService.prototype, 'client', {
  get() { throw new Error('OpenAPI export must not access any database'); },
});
