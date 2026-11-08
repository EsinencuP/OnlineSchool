import { Global, Injectable, Module } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { createPoolClient } from '@online-school/db';
import type { PrismaClient } from '@online-school/db';
import { domainError, fail } from '../errors/domain-error.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private connection: PrismaClient | undefined;
  get client(): PrismaClient {
    if (!this.connection) {
      const result = createPoolClient();
      if (!result.ok) return fail(domainError('DATABASE_UNAVAILABLE', 503));
      this.connection = result.value;
    }
    return this.connection;
  }
  async onModuleDestroy(): Promise<void> {
    await this.connection?.$disconnect();
  }
}
@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
