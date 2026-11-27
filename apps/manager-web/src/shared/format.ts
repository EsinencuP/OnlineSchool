const TZ = 'Europe/Chisinau';

const dtf = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, ...opts });

const timeFmt = dtf({ hour: '2-digit', minute: '2-digit' });
const dayFmt = dtf({ day: 'numeric', month: 'short' });
const dayLongFmt = dtf({ weekday: 'long', day: 'numeric', month: 'long' });
const weekdayFmt = dtf({ weekday: 'short' });
const keyFmt = dtf({ year: 'numeric', month: '2-digit', day: '2-digit' });

export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));

const hourFmt = dtf({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** Decimal hour of the day in school timezone (14:30 → 14.5), independent of the browser timezone. */
export const hourOf = (iso: string) => {
  const p = hourFmt.formatToParts(new Date(iso));
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return get('hour') + get('minute') / 60;
};
export const fmtDay = (iso: string) => dayFmt.format(new Date(iso)).replace('.', '');
export const fmtDayLong = (iso: string) => dayLongFmt.format(new Date(iso));
export const fmtWeekday = (iso: string) => weekdayFmt.format(new Date(iso));
export const fmtDateTime = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`;

/** Calendar day key in school timezone, e.g. 2026-11-24. */
export const dayKey = (iso: string) => {
  const p = keyFmt.formatToParts(new Date(iso));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

export function relative(iso: string, nowIso: string): string {
  const diffMin = Math.round((new Date(iso).getTime() - new Date(nowIso).getTime()) / 60000);
  const abs = Math.abs(diffMin);
  const past = diffMin < 0;
  let text: string;
  if (abs < 1) return 'сейчас';
  if (abs < 60) text = `${abs} мин`;
  else if (abs < 60 * 24) text = `${Math.round(abs / 60)} ч`;
  else text = `${Math.round(abs / 1440)} дн`;
  return past ? `${text} назад` : `через ${text}`;
}

/**
 * Money arrives as decimal strings (INV-05). Group digits without converting
 * to floating point.
 */
export function fmtMoney(amount: string, currency: string): string {
  const negative = amount.startsWith('-');
  const [intPart = '0', frac = ''] = amount.replace('-', '').split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cents = frac.replace(/0+$/, '');
  const body = cents ? `${grouped},${cents.padEnd(2, '0').slice(0, 2)}` : grouped;
  return `${negative ? '−' : ''}${body} ${currency === 'MDL' ? 'лей' : currency}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
