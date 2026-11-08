import { useContext, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getStudentSubscription,
  getStudentSubscriptionLedger,
  getStudentSubscriptionPayments,
} from '@online-school/api-contracts';
import type {
  StudentSubjectDto,
  StudentSubjectSubscriptionDto,
  StudentSubscriptionLedgerEntryDto,
} from '@online-school/api-contracts';
import {
  formatMoneyAmount,
  Icon,
  k8kEnabled,
  StateBoundary,
  useContextRefresh,
  useDataAge,
} from '@online-school/ui';
import { isForbiddenRead, queryClient, subscriptionReadKey, useStudentQuery } from '../api.js';
import { Pager, Panel, QueryState, Status } from '../components.js';
import { useMe } from '../Layout.js';
import { useStudentCopy } from '../student-copy.js';
import { formatStudentDate, StudentReadFreshness } from '../student-presentation.js';
import { SubscriptionPlanFacts } from '../student-widgets.js';
import { useSubscriptionCopy } from '../subscription-copy.js';
import { findSubjectPlan } from '../subscription-presentation.js';
import { SubjectBack, subjectHref, useStudentSubjects } from './Subjects.js';

type PlanMatch = { item: StudentSubjectDto; plan: StudentSubjectSubscriptionDto };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function FrozenWork({ item, plan }: PlanMatch) {
  const { copy } = useStudentCopy();
  const fresh = useContext(StudentReadFreshness);
  if (!fresh || plan.displayStatus !== 'FROZEN') return null;
  return (
    <div className="k8k-frozen-work">
      {item.capabilities.canViewMaterials && (
        <Link className="k8k-student-link" to={subjectHref('/student/materials', item.subjectId)}>
          {copy.materials}
        </Link>
      )}
      {item.capabilities.canViewHomework && (
        <Link
          className="k8k-student-link"
          to={subjectHref('/student/homework', item.subjectId, 'fromSubjectId')}
        >
          {copy.allHomework}
        </Link>
      )}
    </div>
  );
}

function SubjectAccess({
  subjects,
  match,
  fallback,
  timeZone,
}: {
  subjects: ReturnType<typeof useStudentSubjects>;
  match: PlanMatch | undefined;
  fallback: number | null;
  timeZone: string;
}) {
  const { copy } = useSubscriptionCopy();
  const detailsFresh = useContext(StudentReadFreshness);
  return (
    <section className="k8k-subscription-access">
      <h3>
        {copy.access}
        {match ? ` · ${match.item.subjectName}` : ''}
      </h3>
      <QueryState query={subjects} operational sourceTimestamp={subjects.data?.generatedAt}>
        {match ? (
          <>
            <SubscriptionPlanFacts plan={match.plan} timeZone={timeZone} />
            {detailsFresh && <FrozenWork {...match} />}
          </>
        ) : (
          <dl className="k8k-subscription-facts">
            <dt>{copy.paidRemaining}</dt>
            <dd>{fallback ?? copy.unknown}</dd>
          </dl>
        )}
      </QueryState>
    </section>
  );
}

function SubscriptionChooser({
  items,
  subscriptionId,
  disabled,
}: {
  items: readonly StudentSubjectDto[];
  subscriptionId?: string | undefined;
  disabled: boolean;
}) {
  const { copy, locale } = useSubscriptionCopy();
  const { timeZone } = useMe();
  const [, setParams] = useSearchParams();
  const available = items.filter(
    (item) => item.capabilities.canOpenSubscription && item.subscriptions.length,
  );
  if (!available.length) return null;
  return (
    <label className="filter k8k-subscription-picker">
      {copy.choose}
      <select
        value={subscriptionId ?? ''}
        disabled={disabled}
        onChange={(event) => {
          const id = event.target.value;
          const match = findSubjectPlan(available, id);
          setParams(
            (current) => {
              const next = new URLSearchParams(current);
              next.delete('subscriptionId');
              next.delete('fromSubjectId');
              if (match) {
                next.set('subscriptionId', match.plan.subscriptionId);
                next.set('fromSubjectId', match.item.subjectId);
              }
              return next;
            },
            { preventScrollReset: true },
          );
        }}
      >
        <option value="">{copy.defaultPlan}</option>
        {subscriptionId && !findSubjectPlan(available, subscriptionId) && (
          <option value={subscriptionId}>{copy.linkedPlan}</option>
        )}
        {available.map((item) => (
          <optgroup key={item.subjectId} label={item.subjectName}>
            {item.subscriptions.map((plan, index) => (
              <option key={plan.subscriptionId} value={plan.subscriptionId}>
                {item.subjectName}
                {item.subscriptions.length > 1 ? ` · ${index + 1}` : ''}
                {plan.validUntil
                  ? ` · ${formatStudentDate(plan.validUntil, timeZone, false, locale)}`
                  : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function LedgerDescription({ entry }: { entry: StudentSubscriptionLedgerEntryDto }) {
  const { copy } = useSubscriptionCopy();
  switch (entry.description) {
    case 'Списание занятия':
      return copy.historyCharge;
    case 'Начисление оплаченных занятий':
      return copy.historyGrant;
    case 'Отмена списания занятия':
      return copy.historyCancellation;
    case 'Корректировка остатка занятий':
      return copy.historyCorrection;
    case 'Заморозка абонемента':
      return copy.FREEZE;
    case 'Разморозка абонемента':
      return copy.UNFREEZE;
    default:
      return entry.description;
  }
}

function SubscriptionReads({
  subscriptionId,
  subjects,
}: {
  subscriptionId?: string | undefined;
  subjects: ReturnType<typeof useStudentSubjects>;
}) {
  const { locale, copy } = useSubscriptionCopy();
  const { timeZone } = useMe();
  const selection = subscriptionId ? { subscriptionId } : {};
  const scope = subscriptionReadKey(subscriptionId);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const details = useStudentQuery([...scope, 'details'], (o) =>
    getStudentSubscription(selection, o),
  );
  const payments = useStudentQuery([...scope, 'payments', paymentsPage], (o) =>
    getStudentSubscriptionPayments({ page: paymentsPage, ...selection }, o),
  );
  const ledger = useStudentQuery([...scope, 'ledger', ledgerPage], (o) =>
    getStudentSubscriptionLedger({ page: ledgerPage, ...selection }, o),
  );
  const denied = [details, payments, ledger].some((query) => isForbiddenRead(query.error));
  useContextRefresh({
    enabled: k8kEnabled && !denied,
    context: 'financial',
    refresh: () =>
      queryClient.refetchQueries(
        { queryKey: ['student', ...scope], type: 'active' },
        { cancelRefetch: false },
      ),
  });
  const data = details.data;
  const items = isForbiddenRead(subjects.error) ? [] : (subjects.data?.items ?? []);
  const match = findSubjectPlan(items, subscriptionId ?? data?.subscriptionId, !subscriptionId);
  const localDate = (value: string, time = false) =>
    formatStudentDate(value, timeZone, time, locale);
  const paymentPrefix = 'Подтверждённая оплата: ';

  return (
    <>
      {denied ? (
        <StateBoundary state={{ status: 'forbidden' }} />
      ) : (
        <>
          <SubjectBack id={match?.item.subjectId} />
          <Panel
            className="k8k-subscription-detail"
            title={k8kEnabled ? copy.plan : 'Твой абонемент'}
          >
            <QueryState query={details} operational>
              {data?.status === 'NONE' ? (
                <>
                  <Status value="NONE" />
                  <p>{subscriptionId ? copy.future : copy.noPlan}</p>
                </>
              ) : (
                data && (
                  <>
                    <Status value={data.status} />
                    {data.planName && <h3>{data.planName}</h3>}
                    {!k8kEnabled && (
                      <div className="balance">
                        <strong>{data.lessonsRemaining ?? copy.unknown}</strong>
                        <span>{copy.paidRemaining}</span>
                      </div>
                    )}
                    <dl className="k8k-subscription-facts">
                      <dt>{copy.planQuantity}</dt>
                      <dd>{data.lessonsTotal ?? copy.unknown}</dd>
                      {data.validFrom && (
                        <>
                          <dt>{copy.validFrom}</dt>
                          <dd>
                            <time dateTime={data.validFrom}>{localDate(data.validFrom)}</time>
                          </dd>
                        </>
                      )}
                      {data.validUntil && (
                        <>
                          <dt>{copy.validUntil}</dt>
                          <dd>
                            <time dateTime={data.validUntil}>{localDate(data.validUntil)}</time>
                          </dd>
                        </>
                      )}
                      {data.isFrozen && data.frozenFrom && (
                        <>
                          <dt>{copy.frozenFrom}</dt>
                          <dd>
                            <time dateTime={data.frozenFrom}>{localDate(data.frozenFrom)}</time>
                          </dd>
                        </>
                      )}
                      {data.isFrozen && data.frozenUntil && (
                        <>
                          <dt>{copy.frozenUntil}</dt>
                          <dd>
                            <time dateTime={data.frozenUntil}>{localDate(data.frozenUntil)}</time>
                          </dd>
                        </>
                      )}
                    </dl>
                    {k8kEnabled && (
                      <SubjectAccess
                        subjects={subjects}
                        match={match}
                        fallback={data.lessonsRemaining}
                        timeZone={timeZone}
                      />
                    )}
                  </>
                )
              )}
            </QueryState>
            {k8kEnabled && (
              <Link className="k8k-student-link" to="/student/help">
                {copy.renew} <Icon name="arrow" />
              </Link>
            )}
          </Panel>
          <Panel title={copy.paymentHistory}>
            <QueryState
              query={payments}
              operational
              empty={payments.data?.total === 0}
              emptyMessage={copy.paymentEmpty}
            >
              {payments.data && (
                <>
                  {payments.data.items.length ? (
                    <ul className="history-list">
                      {payments.data.items.map((payment, index) => (
                        <li key={`${payment.paymentId}:${index}`}>
                          <strong>
                            {formatMoneyAmount(payment.amount, payment.currency, locale) ??
                              copy.unknown}
                          </strong>
                          <span>
                            {locale === 'ro' && payment.description.startsWith(paymentPrefix)
                              ? payment.description.slice(paymentPrefix.length)
                              : payment.description}
                          </span>
                          <time dateTime={payment.confirmedAt}>
                            {localDate(payment.confirmedAt, true)}
                          </time>
                          <dl className="k8k-subscription-facts">
                            <dt>{copy.lessonsAdded}</dt>
                            <dd>{payment.lessonsAdded ?? copy.unknown}</dd>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{copy.paymentEmpty}</p>
                  )}
                  <Pager {...payments.data} change={setPaymentsPage} />
                </>
              )}
            </QueryState>
          </Panel>
          <Panel title={copy.ledgerHistory}>
            <QueryState
              query={ledger}
              operational
              empty={ledger.data?.total === 0}
              emptyMessage={copy.ledgerEmpty}
            >
              {ledger.data && (
                <>
                  {ledger.data.items.length ? (
                    <ul className="history-list">
                      {ledger.data.items.map((entry) => (
                        <li key={entry.entryId}>
                          <strong>
                            <LedgerDescription entry={entry} />
                          </strong>
                          <span>{copy[entry.type]}</span>
                          <time dateTime={entry.entryDate}>{localDate(entry.entryDate)}</time>
                          <dl className="k8k-subscription-facts">
                            <dt>{copy.balanceBefore}</dt>
                            <dd>{entry.balanceBefore ?? copy.unknown}</dd>
                            <dt>{copy.balanceAfter}</dt>
                            <dd>{entry.balanceAfter ?? copy.unknown}</dd>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{copy.ledgerEmpty}</p>
                  )}
                  <Pager {...ledger.data} change={setLedgerPage} />
                </>
              )}
            </QueryState>
          </Panel>
        </>
      )}
    </>
  );
}

export function Subscription() {
  const { copy } = useSubscriptionCopy();
  const [params] = useSearchParams();
  const ids = params.getAll('subscriptionId');
  const id = ids[0]?.toLowerCase();
  const invalid = ids.length > 1 || (ids.length === 1 && (!id || !uuid.test(id)));
  const subjects = useStudentSubjects(k8kEnabled);
  const subjectsTooOld = useDataAge(subjects.dataUpdatedAt, 120_000);
  return (
    <>
      <h1>{copy.heading}</h1>
      <p className="lead">{copy.intro}</p>
      {k8kEnabled && !isForbiddenRead(subjects.error) && (
        <SubscriptionChooser
          items={subjects.data?.items ?? []}
          subscriptionId={id}
          disabled={subjectsTooOld || !!subjects.error}
        />
      )}
      {invalid ? (
        <StateBoundary state={{ status: 'forbidden' }} />
      ) : (
        <SubscriptionReads key={id ?? ''} subscriptionId={id} subjects={subjects} />
      )}
    </>
  );
}
