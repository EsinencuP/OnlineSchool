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
  const defaultZone = useContext(FreshnessTimeZone);
  const zone = timeZone ?? defaultZone;
  const valid = at && Number.isFinite(at) && !Number.isNaN(new Date(at).getTime());
  return (
    <p className="k8k-freshness">
      {valid ? (
        <>
          Загружено{' '}
          <time dateTime={new Date(at).toISOString()}>
            {new Intl.DateTimeFormat('ru-RU', {
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
        'Время последней успешной загрузки неизвестно'
      )}
      {refreshing && <span> · Обновляем…</span>}
    </p>
  );
}
