import { AppException } from '../errors/domain-error.js';
import { sourceTimestamp } from './actor-context.service.js';
import type { StaffActionEligibilityDto } from './actor-context.dto.js';

/** Projection only. Command handlers must re-run the same checks inside their transaction. */
export async function actionEligibility<Row extends { id: string; updated_at?: Date }>(
  action: StaffActionEligibilityDto['action'],
  now: Date,
  authorize: () => Promise<Row>,
  check: (row: Row) => Promise<void>,
): Promise<StaffActionEligibilityDto> {
  let row: Row | undefined;
  try {
    row = await authorize();
    await check(row);
    return {
      action,
      objectId: row.id,
      revision: null,
      allowed: true,
      reason: null,
      asOf: now.toISOString(),
      sourceUpdatedAt: sourceTimestamp(row.updated_at),
    };
  } catch (error: unknown) {
    if (!(error instanceof AppException) || error.domain.status >= 500)
      return Promise.reject(error);
    return {
      action,
      objectId: row?.id ?? null,
      revision: null,
      allowed: false,
      reason: row ? error.domain.code : 'UNAVAILABLE',
      asOf: now.toISOString(),
      sourceUpdatedAt: sourceTimestamp(row?.updated_at),
    };
  }
}
