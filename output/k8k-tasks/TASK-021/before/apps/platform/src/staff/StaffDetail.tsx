import { useEffect, useState } from 'react';
import { getPlatformWorkspaceDetail } from '@online-school/api-contracts';
import type { WorkspaceDetailDto } from '@online-school/api-contracts';
import { leaveSession, requestOptions, sessionSignal } from '@online-school/account-ui';
import { formatDateTime, queryBoundaryState, StateBoundary, useLocale } from '@online-school/ui';
import type { StaffNavigation, StaffObjectSection, StaffRole } from './navigation.js';
import { useStaffCopy } from './copy.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function StaffDetail({
  accountId,
  role,
  section,
  id,
  reload,
  navigation,
}: {
  accountId: string;
  role: StaffRole;
  section: StaffObjectSection;
  id: string;
  reload: number;
  navigation: StaffNavigation;
}) {
  const { locale } = useLocale();
  const copy = useStaffCopy();
  const [data, setData] = useState<WorkspaceDetailDto>();
  const [status, setStatus] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const valid = uuid.test(id);
  useEffect(() => {
    if (!valid) return;
    const abort = new AbortController();
    const lease = sessionSignal();
    if (lease.aborted) return;
    setLoading(true);
    void getPlatformWorkspaceDetail(section, id, requestOptions(abort.signal)).then((result) => {
      if (lease.aborted || abort.signal.aborted) return;
      if (result.ok) {
        if (
          result.value.actorContext.accountId !== accountId ||
          result.value.actorContext.role !== role
        )
          return leaveSession('/');
        setData(result.value);
        setStatus(undefined);
      } else {
        if (result.error.status === 401) return leaveSession('/account');
        if ([403, 404].includes(result.error.status)) setData(undefined);
        setStatus(result.error.status);
      }
      setLoading(false);
    });
    return () => abort.abort();
  }, [accountId, role, section, id, valid, reload, retry]);

  const item = data?.item;
  const date = (value: string) =>
    data ? (formatDateTime(value, locale, data.actorContext.timezone) ?? '—') : '—';
  return (
    <>
      <a className="staff-back" {...navigation.back()}>
        {copy('back')}
      </a>
      {!valid || status === 404 ? (
        <StateBoundary
          state={{ status: 'error', message: copy(valid ? 'unavailable' : 'badLink') }}
        />
      ) : (
        <StateBoundary
          state={queryBoundaryState({
            isPending: loading,
            hasData: !!item,
            error: status !== undefined,
            errorStatus: status,
          })}
          refreshing={loading}
          asOf={data?.actorContext.asOf}
          retryRead={() => setRetry((value) => value + 1)}
        >
          {item && (
            <section className="panel staff-detail">
              <h2>
                {'startsAt' in item ? item.subject : 'subjects' in item ? item.name : item.title}
              </h2>
              {'startsAt' in item ? (
                <>
                  <p>
                    {item.student} · {item.teacher}
                  </p>
                  <p>
                    <time dateTime={item.startsAt}>{date(item.startsAt)}</time> –{' '}
                    <time dateTime={item.endsAt}>{date(item.endsAt)}</time>
                  </p>
                  <span className="badge">
                    {copy(item.status === 'IN_PROGRESS' ? 'lessonInProgress' : item.status)}
                  </span>
                </>
              ) : 'subjects' in item ? (
                <ul>
                  {item.subjects.map((subject) => (
                    <li key={subject}>{subject}</li>
                  ))}
                </ul>
              ) : (
                <>
                  <p>
                    {'manager' in item
                      ? item.manager === 'Не назначен'
                        ? copy('managerMissing')
                        : item.manager
                      : item.subject}
                  </p>
                  <p>
                    {item.dueAt ? (
                      <time dateTime={item.dueAt}>{date(item.dueAt)}</time>
                    ) : (
                      copy('noDue')
                    )}
                  </p>
                  {'status' in item && <span className="badge">{copy(item.status)}</span>}
                </>
              )}
            </section>
          )}
        </StateBoundary>
      )}
    </>
  );
}
