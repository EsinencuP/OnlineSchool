import { useLocale } from './locale.js';
import { formatDateTime, instantMilliseconds } from './format.js';
import { createContext, useContext } from 'react';
export const FreshnessTimeZone = createContext('Europe/Chisinau');
export const FreshnessDisplay = createContext<'full' | 'compact'>('full');
export type FreshnessSourceProps = {
  asOf?: string | number | null | undefined;
  receivedAt?: number | undefined;
  /** Compatibility alias for receipt time. New consumers should name the source. */
  at?: number | undefined;
};
function timestamp(value: string | number | null | undefined) {
  const at = value == null ? null : instantMilliseconds(value);
  return at !== null && at > 0 ? at : undefined;
}
export function FreshnessLabel({
  asOf,
  receivedAt,
  at,
  timeZone,
  refreshing = false,
}: FreshnessSourceProps & {
  timeZone?: string;
  refreshing?: boolean;
}) {
  const { t, locale } = useLocale();
  const compact = useContext(FreshnessDisplay) === 'compact';
  const defaultZone = useContext(FreshnessTimeZone);
  const zone = timeZone ?? defaultZone;
  const server = timestamp(asOf);
  const receipt = timestamp(receivedAt ?? at);
  const time = (value: number | undefined, source: 'server' | 'client') => {
    if (value === undefined) return null;
    const formatted = formatDateTime(value, locale, zone);
    return formatted === null ? null : (
      <time data-time-source={source} dateTime={new Date(value).toISOString()}>
        {formatted}
      </time>
    );
  };
  const serverTime = time(server, 'server');
  const receiptTime = time(receipt, 'client');
  const fullLabel = [
    server && `${t('serverAsOf')} ${formatDateTime(server, locale, zone)}`,
    receipt && `${t('receivedAt')} ${formatDateTime(receipt, locale, zone)}`,
    zone,
  ]
    .filter(Boolean)
    .join(' · ');
  if (compact && (serverTime || receiptTime))
    return (
      <p className="k8k-freshness k8k-freshness-compact" title={fullLabel} aria-label={fullLabel}>
        {serverTime ? (
          <span>
            {t('serverAsOf')} {serverTime}
          </span>
        ) : (
          <span>
            {t('receivedAt')} {receiptTime}
          </span>
        )}
        {refreshing && <span> · {t('refreshing')}</span>}
      </p>
    );
  return (
    <p className="k8k-freshness">
      {serverTime || receiptTime ? (
        <>
          {serverTime && (
            <span>
              {t('serverAsOf')} {serverTime}
            </span>
          )}
          {serverTime && receiptTime && ' · '}
          {receiptTime && (
            <span>
              {t('receivedAt')} {receiptTime}
            </span>
          )}{' '}
          · {zone}
        </>
      ) : (
        t('unknownTime')
      )}
      {refreshing && <span> · {t('refreshing')}</span>}
    </p>
  );
}
