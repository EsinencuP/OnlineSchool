import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { object, string, uuid } from '../../modules/identity/input.js';
import { PrivateUploads } from '../../modules/storage/private-uploads.service.js';
import { at } from '../../modules/finance/finance-common.js';
import { MeService } from '../me/me.service.js';
import type { IStudentContext } from '../student-context.interface.js';
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
@Injectable()
export class StudentProfileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly me: MeService,
    private readonly storage: PrivateUploads,
  ) {}
  async update(ctx: CriticalContext, student: IStudentContext, body: unknown) {
    const input = object(body, ['displayName', 'avatarFileId']);
    if (!Object.keys(input).length) return fail(domainError('INVALID_INPUT', 400));
    const display_name =
        input.displayName === undefined ? undefined : string(input.displayName, 1, 100),
      avatar_file_id = input.avatarFileId === undefined ? undefined : uuid(input.avatarFileId);
    if (
      display_name &&
      Array.from(display_name).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
    )
      return fail(domainError('INVALID_INPUT', 400));
    const current = unwrap(await this.me.load(student.userId, ctx.tx)).context;
    if (current.studentProfileId !== student.studentProfileId)
      return fail(domainError('FORBIDDEN', 403));
    if (current.mustChangePassword) return fail(domainError('MUST_CHANGE_PASSWORD', 403));
    if (!current.hasActiveAccess)
      return fail({
        ...domainError('ACCESS_SUSPENDED', 402),
        details: { managerContacts: current.managerContacts ?? { whatsapp: '', telegram: '' } },
      });
    await ctx.tx
      .$queryRaw`SELECT id FROM students WHERE id=${student.studentProfileId}::uuid FOR UPDATE`;
    if (avatar_file_id) {
      const time = await at(ctx.tx);
      const file = await ctx.tx.s3Object.findFirst({
        where: {
          id: avatar_file_id,
          uploaded_by: student.userId,
          status: 'VERIFIED',
          verified_at: { lte: time },
          size: { gt: 0n, lte: BigInt(AVATAR_MAX_BYTES) },
          content_type: { in: AVATAR_TYPES },
        },
        select: { id: true },
      });
      if (!file) return fail(domainError('AVATAR_FILE_FORBIDDEN', 403));
    }
    const profile = await ctx.tx.student.update({
      where: { id: student.studentProfileId },
      data: {
        ...(display_name !== undefined ? { display_name } : {}),
        ...(avatar_file_id ? { avatar_file_id } : {}),
      },
      select: { avatar_file_id: true },
    });
    const updated = unwrap(await this.me.load(student.userId, ctx.tx)).me;
    return { ...updated, avatarFileId: profile.avatar_file_id };
  }
  async avatar(student: IStudentContext) {
    const profile = await this.db.client.student.findUnique({
      where: { id: student.studentProfileId },
      select: { avatar_file_id: true },
    });
    if (!profile?.avatar_file_id) return fail(domainError('AVATAR_NOT_FOUND', 404));
    const time = await at(this.db.client);
    const file = await this.db.client.s3Object.findFirst({
      where: {
        id: profile.avatar_file_id,
        status: 'VERIFIED',
        verified_at: { lte: time },
        size: { gt: 0n, lte: BigInt(AVATAR_MAX_BYTES) },
        content_type: { in: AVATAR_TYPES },
        uploaded_by_ref: { student_profile: { student_id: student.studentProfileId } },
      },
      select: { bucket: true, key: true, content_type: true, size: true },
    });
    if (!file) return fail(domainError('AVATAR_NOT_FOUND', 404));
    return this.storage.readAvatar(file.bucket, file.key, file.content_type, Number(file.size));
  }
}
