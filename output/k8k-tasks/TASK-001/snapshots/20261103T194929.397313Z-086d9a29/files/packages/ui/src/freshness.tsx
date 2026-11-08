import { useLocale } from './locale.js';
import { createContext, useContext } from 'react';
export const FreshnessTimeZone = createContext('Europe/Chisinau');
export function FreshnessLabel({
  at,
  timeZone,
  refreshing = false,
}: {
  at?: number | undefined;
  timeZone?: string;
  refreshing?: boolean;
}) {
  const { t, intlLocale } = useLocale();
  const defaultZone = useContext(FreshnessTimeZone);
  const zone = timeZone ?? defaultZone;
  const valid = at && Number.isFinite(at) && !Number.isNaN(new Date(at).getTime());
  return (
    <p className="k8k-freshness">
      {valid ? (
        <>
          {t('loaded')}{' '}
          <time dateTime={new Date(at).toISOString()}>
            {new Intl.DateTimeFormat(intlLocale, {
              timeZone: zone,
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }).format(at)}
          </time>{' '}
          · {zone}
        </>
      ) : (
        t('unknownTime')
      )}
      {refreshing && <span> · {t('refreshing')}</span>}
    </p>
  );
}
