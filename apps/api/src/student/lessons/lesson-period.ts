import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { object } from '../../modules/identity/input.js';
import type { LessonsQueryDto } from './lessons.dto.js';

export type ParsedLessonsQuery = {
  period: NonNullable<LessonsQueryDto['period']>;
  page: number;
  pageSize: number;
  month?: string;
};
@Injectable()
export class LessonsQueryPipe implements PipeTransform {
  transform(value: unknown): ParsedLessonsQuery {
    const input = object(value, ['period', 'page', 'pageSize', 'month']);
    const period = input.period ?? (input.month === undefined ? 'week' : 'month');
    if (!['today', 'week', 'month', 'archive'].includes(period as string))
      return fail(domainError('INVALID_LESSON_QUERY', 400));
    const integer = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
      if (value === undefined) return fallback;
      if (
        typeof value !== 'string' ||
        !/^[1-9]\d*$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) > max
      )
        return fail(domainError('INVALID_LESSON_QUERY', 400));
      return Number(value);
    };
    const page = integer(input.page, 1),
      pageSize = integer(input.pageSize, 20, 100);
    if (!Number.isSafeInteger((page - 1) * pageSize))
      return fail(domainError('INVALID_LESSON_QUERY', 400));
    if (input.month !== undefined) {
      if (
        typeof input.month !== 'string' ||
        !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(input.month) ||
        period !== 'month' ||
        input.page !== undefined ||
        input.pageSize !== undefined
      )
        return fail(domainError('INVALID_LESSON_QUERY', 400));
      return { period: 'month', page: 1, pageSize: 62, month: input.month };
    }
    return { period: period as ParsedLessonsQuery['period'], page, pageSize };
  }
}
export function lessonPeriod(query: ParsedLessonsQuery, time: Date, zone = 'Europe/Chisinau') {
  try {
    const today = Temporal.Instant.fromEpochMilliseconds(+time)
      .toZonedDateTimeISO(zone)
      .toPlainDate();
    if (query.period === 'archive') return { from: null, until: null, today: today.toString() };
    const from = query.month
      ? Temporal.PlainYearMonth.from(query.month).toPlainDate({ day: 1 })
      : query.period === 'today'
        ? today
        : query.period === 'week'
          ? today.subtract({ days: today.dayOfWeek - 1 })
          : today.with({ day: 1 });
    const until =
      query.period === 'today'
        ? from.add({ days: 1 })
        : query.period === 'week'
          ? from.add({ weeks: 1 })
          : from.add({ months: 1 });
    return {
      from: new Date(from.toZonedDateTime(zone).epochMilliseconds),
      until: new Date(until.toZonedDateTime(zone).epochMilliseconds),
      today: today.toString(),
    };
  } catch {
    return fail(domainError('STUDENT_TIMEZONE_UNAVAILABLE', 503));
  }
}
export function preferredDate(value: unknown, today: string): string {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value))
    return fail(domainError('INVALID_PREFERRED_DATE', 422));
  try {
    const date = Temporal.PlainDate.from(value, { overflow: 'reject' });
    if (date.toString() !== value || value < today)
      return fail(domainError('INVALID_PREFERRED_DATE', 422));
    return value;
  } catch {
    return fail(domainError('INVALID_PREFERRED_DATE', 422));
  }
}
