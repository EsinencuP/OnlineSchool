import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { Passwords } from '../../modules/identity/passwords.js';
import { IdentityService, now } from '../../modules/identity/identity.service.js';
import { object, email, string } from '../../modules/identity/input.js';
import { SessionStore } from '../../core/session/session.store.js';
import type { StudentRequest, IStudentContext } from '../student-context.interface.js';
import { StudentSecurityCommands } from './security-commands.js';
import { EmailOtp, EmailOtpMailer, EMAIL_OTP_TTL_MS, EMAIL_OTP_MAX_ATTEMPTS } from './email-otp.js';
@Injectable()
export class StudentEmailService {
  constructor(
    private readonly commands: StudentSecurityCommands,
    private readonly passwords: Passwords,
    private readonly otp: EmailOtp,
    private readonly mail: EmailOtpMailer,
    private readonly db: DatabaseService,
    private readonly identity: IdentityService,
    private readonly sessions: SessionStore,
  ) {}
  async request(
    req: StudentRequest,
    student: IStudentContext,
    body: unknown,
  ): Promise<{ message: string }> {
    const input = object(body, ['newEmail', 'currentPassword']),
      address = email(input.newEmail),
      password = input.currentPassword;
    if (typeof password !== 'string' || password.length < 1 || password.length > 256)
      return fail(domainError('INVALID_INPUT', 400));
    this.mail.configured();
    this.otp.configured();
    let delivery: { id: string; code: string } | undefined;
    await this.commands.run(
      req,
      student,
      'student.email.request',
      async (tx, account, _actor, time) => {
        if (!(await this.passwords.verify(password, account.password_hash)))
          return { resourceId: account.id, error: domainError('CURRENT_PASSWORD_INVALID', 401) };
        if (
          address === account.login_id ||
          (await tx.authAccount.findFirst({
            where: { login_id: { equals: address, mode: 'insensitive' } },
            select: { id: true },
          }))
        )
          return { resourceId: account.id, error: domainError('EMAIL_UNAVAILABLE', 409) };
        await tx.studentEmailChange.updateMany({
          where: { account_id: account.id, used_at: null, revoked_at: null },
          data: { revoked_at: time },
        });
        const previous = await tx.studentEmailChange.findMany({
          where: { account_id: account.id, new_email: address, expires_at: { gt: time } },
          select: { id: true, otp_hash: true },
        });
        const id = randomUUID();
        let code = this.otp.generate(),
          collisions = 0;
        while (
          previous.some((old) =>
            this.otp.matches(old.id, account.id, address, code, old.otp_hash),
          ) &&
          collisions++ < 10
        )
          code = this.otp.generate();
        if (
          previous.some((old) => this.otp.matches(old.id, account.id, address, code, old.otp_hash))
        )
          return fail(domainError('OTP_GENERATION_UNAVAILABLE', 503));
        await tx.studentEmailChange.create({
          data: {
            id,
            account_id: account.id,
            student_id: student.studentProfileId,
            new_email: address,
            otp_hash: this.otp.digest(id, account.id, address, code),
            issued_at: time,
            expires_at: new Date(+time + EMAIL_OTP_TTL_MS),
          },
        });
        delivery = { id, code };
        return { resourceId: id, body: {} };
      },
    );
    if (!delivery) return fail(domainError('EMAIL_DELIVERY_UNAVAILABLE', 503));
    await this.mail.send(delivery.id, address, delivery.code);
    // Network I/O is outside the critical transaction. A concurrent newer request
    // invalidates this code; do not claim success for that superseded challenge.
    const time = await now(this.db.client),
      sent = await this.db.client.studentEmailChange.updateMany({
        where: { id: delivery.id, used_at: null, revoked_at: null, expires_at: { gt: time } },
        data: { sent_at: time },
      });
    if (sent.count !== 1) return fail(domainError('EMAIL_REQUEST_SUPERSEDED', 409));
    return { message: 'OTP отправлен на новый email' };
  }
  async confirm(req: StudentRequest, student: IStudentContext, body: unknown) {
    const input = object(body, ['newEmail', 'otp']),
      address = email(input.newEmail),
      code = string(input.otp, 6, 6);
    if (!/^\d{6}$/.test(code)) return fail(domainError('INVALID_INPUT', 400));
    return this.commands.run<{ email: string }>(
      req,
      student,
      'student.email.change',
      async (tx, account, _actor, time) => {
        const pending = await tx.studentEmailChange.findFirst({
          where: {
            account_id: account.id,
            student_id: student.studentProfileId,
            new_email: address,
            used_at: null,
            revoked_at: null,
          },
          orderBy: [{ issued_at: 'desc' }, { id: 'desc' }],
        });
        const invalid = { resourceId: account.id, error: domainError('EMAIL_OTP_INVALID', 400) };
        if (
          !pending ||
          pending.used_at ||
          pending.revoked_at ||
          pending.expires_at <= time ||
          pending.attempts >= EMAIL_OTP_MAX_ATTEMPTS
        )
          return invalid;
        if (!this.otp.matches(pending.id, account.id, address, code, pending.otp_hash)) {
          const attempts = pending.attempts + 1;
          await tx.studentEmailChange.update({
            where: { id: pending.id },
            data: { attempts, ...(attempts >= EMAIL_OTP_MAX_ATTEMPTS ? { revoked_at: time } : {}) },
          });
          return invalid;
        }
        const taken = await tx.authAccount.findFirst({
          where: { login_id: { equals: address, mode: 'insensitive' } },
          select: { id: true },
        });
        if (taken) return { resourceId: account.id, error: domainError('EMAIL_UNAVAILABLE', 409) };
        await tx.studentEmailChange.update({ where: { id: pending.id }, data: { used_at: time } });
        await tx.authAccount.update({
          where: { id: account.id },
          data: { login_id: address, email_verified_at: time },
        });
        await this.identity.revoke(tx, account.id, account.id, 'STUDENT_EMAIL_CHANGED', true);
        const issued = await this.sessions.issue(tx, account.id, null, false, req);
        return { resourceId: account.id, body: { email: address }, issued };
      },
    );
  }
}
