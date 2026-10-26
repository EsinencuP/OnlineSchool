import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { RecoveryService } from './recovery.service.js';
import { Passwords } from './passwords.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { WebAuthnConfig } from './webauthn.config.js';
@Module({
  controllers: [IdentityController],
  providers: [IdentityService, RecoveryService, Passwords, AuthRateLimitService, WebAuthnConfig],
  exports: [Passwords],
})
export class IdentityModule {}
