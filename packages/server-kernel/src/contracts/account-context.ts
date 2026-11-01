import type { RoleCode } from '@online-school/db';

export interface AccountContext {
  accountId: string;
  sessionId: string;
  roles: RoleCode[];
  role: RoleCode;
  kind: 'STAFF' | 'TEACHER' | 'STUDENT';
  mfaCompleted: boolean;
  lastActiveAt: Date;
  expiresAt: Date;
  recoveryOnly?: boolean;
}
