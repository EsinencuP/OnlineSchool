import { useState } from 'react';
import {
  EmptyState,
  ErrorState,
  Field,
  FreshnessLabel,
  Skeleton,
  StagesTrack,
  StaleBanner,
  StateBoundary,
  useLocale,
} from '../src/index.js';
import type { BoundaryState, Locale } from '../src/index.js';

export default {
  title: 'UI/VIS-11',
  includeStories: [
    'Loading',
    'Empty',
    'Ready',
    'Stale',
    'Error',
    'UnknownResult',
    'Forbidden',
    'SubscriptionLimited',
    'SessionExpired',
    'PendingEditor',
    'NoticePrimitives',
    'Freshness',
    'Stages',
  ],
};
const states: BoundaryState[] = [
  { status: 'loading' },
  { status: 'empty' },
  { status: 'ready' },
  { status: 'stale', empty: true },
  { status: 'error' },
  { status: 'pending', outcome: 'unknown' },
  { status: 'forbidden' },
  { status: 'subscription-limited' },
  { status: 'session-expired' },
];
const receivedAt = Date.UTC(2026, 10, 4, 8);
const asOf = '2026-11-04T07:40:00Z';

function StateExample({ locale, state }: { locale: Locale; state: BoundaryState }) {
  const ro = locale === 'ro';
  const [reads, setReads] = useState(0);
  return (
    <>
      <StateBoundary
        state={state}
        asOf={state.status === 'ready' ? asOf : undefined}
        receivedAt={state.status === 'ready' || state.status === 'stale' ? receivedAt : undefined}
        retryRead={() => setReads((value) => value + 1)}
      >
        {state.status === 'subscription-limited' ? (
          <p data-authorized>
            {ro
              ? 'Disciplina autorizată rămâne disponibilă.'
              : 'Разрешённый предмет остаётся доступен.'}
          </p>
        ) : state.status === 'ready' || state.status === 'pending' ? (
          <p data-synthetic-content>
            {ro ? 'Date pentru exemplul local' : 'Данные локального примера'}
          </p>
        ) : null}
      </StateBoundary>
      {reads > 0 && (
        <output>
          {ro ? 'Citiri locale' : 'Локальные чтения'}: {reads}
        </output>
      )}
    </>
  );
}

export function ReadStates({ locale }: { locale: Locale }) {
  const ro = locale === 'ro';
  const titles = ro
    ? [
        'Încărcare',
        'Listă goală',
        'Date disponibile',
        'Date posibil vechi',
        'Eroare',
        'Rezultat necunoscut',
        'Acces refuzat',
        'Acces parțial',
        'Sesiune expirată',
      ]
    : [
        'Загрузка',
        'Пустой список',
        'Данные доступны',
        'Устаревшие данные',
        'Ошибка',
        'Неизвестный результат',
        'Отказ в доступе',
        'Частичный доступ',
        'Сессия завершена',
      ];
  return (
    <div className="state-catalog">
      {states.map((state, index) => (
        <section key={state.status} data-example={state.status}>
          <h2>{titles[index]}</h2>
          <StateExample locale={locale} state={state} />
        </section>
      ))}
      <StagesTrack
        label={ro ? 'Etapa primului exemplu' : 'Этап первого примера'}
        stage="PRACTICING"
      />
      <StagesTrack
        label={ro ? 'Etapa celui de-al doilea exemplu' : 'Этап второго примера'}
        stage="NOT_STUDIED"
      />
    </div>
  );
}

export function RetainedEditor({
  state,
  refreshing = false,
  locale,
}: {
  state: BoundaryState;
  refreshing?: boolean;
  locale: Locale;
}) {
  return (
    <StateBoundary state={state} refreshing={refreshing}>
      <Field
        id="story-draft"
        label={locale === 'ro' ? 'Ciornă' : 'Черновик'}
        defaultValue="Synthetic draft"
      />
    </StateBoundary>
  );
}

export const Romanian = { args: { locale: 'ro' }, render: ReadStates };
export const Russian = { args: { locale: 'ru' }, render: ReadStates };
export const Loading = { args: { state: { status: 'loading' } }, render: StateExample };
export const Empty = { args: { state: { status: 'empty' } }, render: StateExample };
export const Ready = { args: { state: { status: 'ready' } }, render: StateExample };
export const Stale = { args: { state: { status: 'stale', empty: true } }, render: StateExample };
export const Error = { args: { state: { status: 'error' } }, render: StateExample };
export const UnknownResult = {
  args: { state: { status: 'pending', outcome: 'unknown' } },
  render: StateExample,
};
export const Forbidden = { args: { state: { status: 'forbidden' } }, render: StateExample };
export const SubscriptionLimited = {
  args: { state: { status: 'subscription-limited' } },
  render: StateExample,
};
export const SessionExpired = {
  args: { state: { status: 'session-expired' } },
  render: StateExample,
};
export const PendingEditor = {
  args: { locale: 'ro', state: { status: 'pending', outcome: 'pending' } },
  render: RetainedEditor,
};

export const NoticePrimitives = {
  render: function NoticePrimitivesExample() {
    const { t } = useLocale();
    const [retry, setRetry] = useState(0);
    const retryRead = () => setRetry((value) => value + 1);
    return (
      <>
        <section aria-label={t('loading')}>
          <Skeleton lines={3} />
        </section>
        <EmptyState />
        <ErrorState retryRead={retryRead} />
        <StaleBanner empty refreshing retryRead={retryRead} />
        <output>{retry}</output>
      </>
    );
  },
};

export const Freshness = {
  render: () => (
    <>
      <FreshnessLabel asOf={asOf} receivedAt={receivedAt} timeZone="Europe/Chisinau" />
      <FreshnessLabel receivedAt={receivedAt} timeZone="UTC" refreshing />
      <FreshnessLabel />
    </>
  ),
};

function StageExamples({ locale }: { locale: Locale }) {
  return (
    <>
      {(['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING', null] as const).map(
        (stage, index) => (
          <StagesTrack
            key={stage ?? 'unknown'}
            label={locale === 'ro' ? `Exemplul ${index + 1}` : `Пример ${index + 1}`}
            stage={stage}
          />
        ),
      )}
    </>
  );
}
export const Stages = { render: StageExamples };
