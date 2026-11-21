import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { components } from '@online-school/api-contracts';
import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatMoneyAmount,
  Icon,
  useContextRefresh,
  useLocale,
} from '@online-school/ui';
import { SubjectIcon } from './Brand.js';
import { CabinetError } from './contract.js';
import { CabinLink } from './Home.js';
import { StudyPager } from './StudentLesson.js';
import { SubjectBack } from './StudentSubjects.js';
import { useEndpoint } from './hooks.js';
import {
  studentSubscriptionPath,
  studentSubscriptionUrl,
  subjectSelection,
  withSubject,
} from './studentSubjectRoutes.js';

type Schemas = components['schemas'];
type Plan = Schemas['StudentSubjectSubscriptionDto'];
type Subject = Schemas['StudentSubjectDto'];
type Navigate = (url: string) => void;

const copy = {
  choose: ['Показать абонемент по предмету', 'Arată abonamentul pe disciplină'],
  defaultPlan: ['Текущий абонемент', 'Abonamentul curent'],
  linkedPlan: ['Абонемент по ссылке', 'Abonamentul din link'],
  period: ['Период абонемента', 'Perioada abonamentului'],
  remaining: ['Осталось оплаченных уроков', 'Lecții plătite rămase'],
  included: ['Уроков по условиям плана', 'Lecții incluse în plan'],
  validFrom: ['Начало периода', 'Începutul perioadei'],
  validUntil: ['Действует до', 'Valabil până la'],
  frozenFrom: ['Начало заморозки', 'Începutul suspendării'],
  frozenUntil: ['Заморожен до', 'Suspendat până la'],
  admission: ['Временный допуск', 'Acces temporar'],
  admissionRemaining: ['Осталось уроков по допуску', 'Lecții rămase cu acces temporar'],
  admissionLimit: ['Лимит уроков по допуску', 'Limita de lecții cu acces temporar'],
  admissionUntil: ['Допуск действует до', 'Acces temporar valabil până la'],
  history: ['История абонемента', 'Istoricul abonamentului'],
  payments: ['Оплаты', 'Plăți'],
  paidAmount: ['Сумма оплаты', 'Suma plății'],
  ledger: ['Движение уроков', 'Mișcarea lecțiilor'],
  emptyPayments: ['Подтверждённых оплат пока нет.', 'Nu există încă plăți confirmate.'],
  emptyLedger: ['Операций с остатком пока нет.', 'Nu există încă operațiuni privind soldul.'],
  lessonsAdded: ['Начислено уроков', 'Lecții adăugate'],
  before: ['Уроков до операции', 'Lecții înainte de operațiune'],
  after: ['Уроков после операции', 'Lecții după operațiune'],
  openLesson: ['Открыть урок', 'Deschide lecția'],
  askManager: ['Связаться с менеджером', 'Contactează managerul'],
  unknown: ['Не зафиксировано', 'Neînregistrat'],
  noPlan: [
    'Период абонемента пока недоступен.',
    'Perioada abonamentului nu este încă disponibilă.',
  ],
  future: [
    'Выбранный период ещё не начался. История оплат доступна ниже.',
    'Perioada selectată nu a început încă. Istoricul plăților este disponibil mai jos.',
  ],
  unavailable: ['Абонемент недоступен.', 'Abonamentul nu este disponibil.'],
  loading: ['Загружаем данные…', 'Se încarcă datele…'],
  failed: ['Не удалось загрузить данные.', 'Datele nu au putut fi încărcate.'],
  retry: ['Повторить', 'Încearcă din nou'],
  refresh: ['Обновить данные', 'Actualizează datele'],
  ACTIVE: ['Действует', 'Activ'],
  FROZEN: ['Заморожен', 'Suspendat'],
  EXPIRED: ['Истёк', 'Expirat'],
  NONE: ['Недоступен', 'Indisponibil'],
  DEDUCTION: ['Списание', 'Deducere'],
  CREDIT: ['Начисление', 'Creditare'],
  FREEZE: ['Заморозка', 'Suspendare temporară'],
  UNFREEZE: ['Разморозка', 'Reluare'],
} as const;

const ledgerDescriptions: Record<string, string> = {
  'Списание занятия': 'Deducerea unei lecții',
  'Начисление оплаченных занятий': 'Creditarea lecțiilor plătite',
  'Отмена списания занятия': 'Anularea deducerii unei lecții',
  'Корректировка остатка занятий': 'Corectarea soldului de lecții',
  'Заморозка абонемента': 'Suspendarea abonamentului',
  'Разморозка абонемента': 'Reluarea abonamentului',
};

function usePlanCopy() {
  const { locale } = useLocale();
  return { locale, text: (key: keyof typeof copy) => copy[key][locale === 'ro' ? 1 : 0] };
}

function PlanDate({ value, zone }: { value: string; zone?: string }) {
  const { locale, text } = usePlanCopy();
  const date = zone
    ? formatDateTime(value, locale, zone)
    : formatDateOnly(value, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return date ? <time dateTime={value}>{date}</time> : text('unknown');
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  const { text } = usePlanCopy();
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? text('unknown')}</dd>
    </div>
  );
}

function ReadState({ error, retry }: { error: unknown; retry: () => void }) {
  const { text } = usePlanCopy();
  if (!error)
    return (
      <p className="cab-empty" role="status">
        <span className="cab-spinner" /> {text('loading')}
      </p>
    );
  return (
    <div className="cab-empty cab-empty-error" role="alert">
      {text('failed')}
      <button type="button" className="cab-text-button" onClick={retry}>
        {text('retry')}
      </button>
    </div>
  );
}

function PlanOverview({
  details,
  match,
  selected,
  zone,
}: {
  details: Schemas['SubscriptionDetailsDto'];
  match: { item: Subject; plan: Plan } | undefined;
  selected: boolean;
  zone: string;
}) {
  const { text } = usePlanCopy();
  const admission = match?.plan.temporaryAdmission;
  const tones = { ACTIVE: 'mint', FROZEN: 'blue', EXPIRED: 'rose', NONE: 'violet' };
  return (
    <div className="cab-lesson-grid">
      <section className="cab-card cab-panel cab-lesson-stack cab-subscription-period">
        <div className="cab-subject-intro">
          {match ? (
            <SubjectIcon subject={match.item.subjectName} />
          ) : (
            <Icon name="wallet" size={25} />
          )}
          <div>
            <h2>{match?.item.subjectName ?? text('period')}</h2>
            {details.planName && <p>{details.planName}</p>}
          </div>
          <span className={'cab-status cab-tone-' + tones[details.status]}>
            {text(details.status)}
          </span>
        </div>
        {details.status === 'NONE' ? (
          <p className="cab-empty">{text(selected ? 'future' : 'noPlan')}</p>
        ) : (
          <dl className="cab-lesson-balance cab-subscription-dates">
            {details.validFrom && (
              <Fact label={text('validFrom')} value={<PlanDate value={details.validFrom} />} />
            )}
            {details.validUntil && (
              <Fact label={text('validUntil')} value={<PlanDate value={details.validUntil} />} />
            )}
            {details.isFrozen && details.frozenFrom && (
              <Fact label={text('frozenFrom')} value={<PlanDate value={details.frozenFrom} />} />
            )}
            {details.isFrozen && details.frozenUntil && (
              <Fact label={text('frozenUntil')} value={<PlanDate value={details.frozenUntil} />} />
            )}
          </dl>
        )}
      </section>
      {details.status !== 'NONE' && (
        <section className="cab-card cab-panel cab-subscription-balance cab-tone-violet">
          <h2>{text('remaining')}</h2>
          <strong className="cab-metric-value">
            {details.lessonsRemaining ?? text('unknown')}
          </strong>
          <dl className="cab-lesson-balance">
            <Fact label={text('included')} value={details.lessonsTotal} />
          </dl>
        </section>
      )}
      {admission && (
        <section className="cab-card cab-panel cab-subscription-admission cab-tone-peach">
          <h2>{text('admission')}</h2>
          <dl className="cab-lesson-balance">
            <Fact label={text('admissionRemaining')} value={admission.lessonsRemaining} />
            <Fact label={text('admissionLimit')} value={admission.maxLessons} />
            <Fact
              label={text('admissionUntil')}
              value={<PlanDate value={admission.validUntil} zone={zone} />}
            />
          </dl>
        </section>
      )}
    </div>
  );
}

function Payments({ items, zone }: { items: Schemas['PaymentHistoryItemDto'][]; zone: string }) {
  const { locale, text } = usePlanCopy();
  if (!items.length) return <p className="cab-empty">{text('emptyPayments')}</p>;
  const prefix = 'Подтверждённая оплата: ';
  return (
    <ul className="cab-subscription-history">
      {items.map((payment, index) => (
        <li key={payment.paymentId + ':' + index}>
          <div>
            <span className="cab-detail-subtitle">{text('paidAmount')}</span>
            <strong>
              {formatMoneyAmount(payment.amount, payment.currency, locale) ?? text('unknown')}
            </strong>
            <p>
              {payment.description.startsWith(prefix)
                ? payment.description.slice(prefix.length)
                : payment.description}
            </p>
            <PlanDate value={payment.confirmedAt} zone={zone} />
          </div>
          <dl className="cab-lesson-balance">
            <Fact label={text('lessonsAdded')} value={payment.lessonsAdded} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Ledger({
  items,
  subjectId,
  navigate,
}: {
  items: Schemas['StudentSubscriptionLedgerEntryDto'][];
  subjectId: string | undefined;
  navigate: Navigate;
}) {
  const { locale, text } = usePlanCopy();
  if (!items.length) return <p className="cab-empty">{text('emptyLedger')}</p>;
  return (
    <ul className="cab-subscription-history">
      {items.map((entry) => (
        <li key={entry.entryId}>
          <div>
            <strong>
              {locale === 'ro'
                ? (ledgerDescriptions[entry.description] ?? entry.description)
                : entry.description}
            </strong>
            <p>
              {text(entry.type)} · <PlanDate value={entry.entryDate} />
            </p>
            {entry.lessonId && (
              <CabinLink
                to={withSubject(
                  '/student/lessons/' + encodeURIComponent(entry.lessonId),
                  subjectId,
                )}
                navigate={navigate}
                className="cab-inline-link"
              >
                {text('openLesson')} <Icon name="arrow" size={15} />
              </CabinLink>
            )}
          </div>
          <dl className="cab-lesson-balance">
            <Fact label={text('before')} value={entry.balanceBefore} />
            <Fact label={text('after')} value={entry.balanceAfter} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

export default function StudentSubscription({
  search,
  zone,
  navigate,
  refreshAccess,
}: {
  search: string;
  zone: string;
  navigate: Navigate;
  refreshAccess: () => void;
}) {
  const { locale, text } = usePlanCopy();
  const selectId = useId();
  const selected = subjectSelection(search, 'subscriptionId');
  const invalid = selected === '';
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<'payments' | 'ledger'>('payments');
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const subjects = useEndpoint<Schemas['StudentSubjectsResponseDto']>(
    'getStudentSubjects',
    {},
    {},
    revision,
  );
  const details = useEndpoint<Schemas['SubscriptionDetailsDto']>(
    invalid ? null : 'getStudentSubscription',
    {},
    selected ? { subscriptionId: selected } : {},
    revision,
  );
  const choices = (subjects.data?.items ?? [])
    .filter((item) => item.capabilities.canOpenSubscription)
    .flatMap((item) => item.subscriptions.map((plan) => ({ item, plan })));
  const detailId = details.data?.subscriptionId;
  const match = selected
    ? choices.find(({ plan }) => plan.subscriptionId === selected)
    : choices.find(
        ({ plan }) =>
          detailId && (plan.subscriptionId === detailId || plan.managerSubscriptionId === detailId),
      );
  // Details may return a grouping ID. Histories accept the owned financial period ID.
  const anchor = selected || match?.plan.subscriptionId;
  const selection = anchor ? { subscriptionId: anchor } : {};
  const historyEnabled = details.data && (selected || !subjects.pending);
  const payments = useEndpoint<Schemas['PaymentHistoryResponseDto']>(
    historyEnabled && view === 'payments' ? 'getStudentSubscriptionPayments' : null,
    {},
    { ...selection, page: paymentsPage },
    revision,
  );
  const ledger = useEndpoint<Schemas['StudentSubscriptionLedgerResponseDto']>(
    historyEnabled && view === 'ledger' ? 'getStudentSubscriptionLedger' : null,
    {},
    { ...selection, page: ledgerPage },
    revision,
  );
  const history = view === 'payments' ? payments : ledger;
  const accessChanged = [details.error, subjects.error, history.error].some(
    (error) =>
      error instanceof CabinetError &&
      (error.issue.status === 401 ||
        error.issue.status === 402 ||
        error.issue.code === 'MUST_CHANGE_PASSWORD'),
  );
  const forbidden = [details.error, history.error].some(
    (error) => error instanceof CabinetError && error.issue.status === 403,
  );
  function refresh() {
    setRevision((value) => value + 1);
  }
  const refreshing = subjects.pending || details.pending || history.pending;
  useContextRefresh({
    enabled: !invalid && !accessChanged && !forbidden,
    paused: refreshing,
    context: 'financial',
    refresh: async () => refresh(),
  });

  if (accessChanged)
    return (
      <div className="cab-empty cab-empty-error" role="alert">
        {text('unavailable')}
        <button type="button" className="cab-text-button" onClick={refreshAccess}>
          {text('refresh')}
        </button>
      </div>
    );

  return (
    <div className="cab-lesson-stack">
      <div className="cab-subscription-controls">
        <div className="cab-form-label">
          <label htmlFor={selectId}>{text('choose')}</label>
          <select
            id={selectId}
            value={selected ?? ''}
            onChange={(event) => {
              const id = event.target.value;
              const choice = choices.find(({ plan }) => plan.subscriptionId === id);
              navigate(
                choice
                  ? studentSubscriptionUrl(id, choice.item.subjectId)
                  : studentSubscriptionPath,
              );
            }}
          >
            <option value="">{text('defaultPlan')}</option>
            {selected && !match && <option value={selected}>{text('linkedPlan')}</option>}
            {choices.map(({ item, plan }) => (
              <option key={plan.subscriptionId} value={plan.subscriptionId}>
                {item.subjectName}
                {plan.validUntil &&
                  ' · ' + (formatDate(plan.validUntil, locale, zone) ?? text('unknown'))}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="cab-button cab-secondary"
          onClick={refresh}
          disabled={refreshing}
        >
          <Icon name="refresh" size={17} /> {text('refresh')}
        </button>
      </div>
      {subjects.error && <ReadState error={subjects.error} retry={subjects.refresh} />}
      {invalid || forbidden ? (
        <p className="cab-empty cab-empty-error" role="alert">
          {text('unavailable')}
        </p>
      ) : details.data ? (
        <>
          {match && <SubjectBack id={match.item.subjectId} navigate={navigate} />}
          <PlanOverview
            details={details.data}
            match={match}
            selected={Boolean(selected)}
            zone={zone}
          />
          <section className="cab-card cab-panel cab-lesson-stack">
            <h2>{text('history')}</h2>
            <div className="cab-tabs" role="group" aria-label={text('history')}>
              {(['payments', 'ledger'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={view === tab}
                  onClick={() => setView(tab)}
                >
                  {text(tab)}
                </button>
              ))}
            </div>
            {view === 'payments' && payments.data ? (
              <Payments items={payments.data.items} zone={zone} />
            ) : view === 'ledger' && ledger.data ? (
              <Ledger
                items={ledger.data.items}
                subjectId={match?.item.subjectId}
                navigate={navigate}
              />
            ) : (
              <ReadState error={history.error} retry={history.refresh} />
            )}
            {history.data && (
              <StudyPager
                {...history.data}
                change={view === 'payments' ? setPaymentsPage : setLedgerPage}
              />
            )}
          </section>
        </>
      ) : (
        <ReadState error={details.error} retry={details.refresh} />
      )}
      <CabinLink to="/student/help" navigate={navigate} className="cab-inline-link">
        <Icon name="manager" size={17} /> {text('askManager')}
      </CabinLink>
    </div>
  );
}
