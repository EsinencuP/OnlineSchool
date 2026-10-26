import { Module } from '@nestjs/common';
import { RegistryService } from './registry.service.js';
import { RegistryController } from './registry.controller.js';
@Module({ controllers: [RegistryController], providers: [RegistryService] })
export class CrmModule {}
