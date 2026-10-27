import { Module } from '@nestjs/common';
import { PrivateUploads } from './private-uploads.service.js';
@Module({ providers: [PrivateUploads], exports: [PrivateUploads] })
export class StorageModule {}
