import { useEffect, useState } from 'react';
import {
  currentSession,
  getComponentStatus,
  getPlatformWorkspace,
} from '@online-school/api-contracts';
import type {
  SessionResponse,
  PlatformWorkspaceDto as Workspace,
} from '@online-school/api-contracts';
import {
  AccountMenu,
  accountRoleLabel,
  leaveSession,
  requestOptions,
  roleHome,
  sessionSignal,
} from '@online-school/account-ui';
import {
  AppShell,
  k8kEnabled,
  queryBoundaryState,
  roleNavigation,
  StateBoundary,
  useContextRefresh,
  useDataAge,
  useLocale,
} from '@online-school/ui';
import { useStaffNavigation } from './navigation.js';
import type { StaffRole, StaffSection } from './navigation.js';
import { StaffWorkspace } from './StaffWorkspace.js';
import { StaffDetail } from './StaffDetail.js';
import { useStaffCopy } from './copy.js';
import './staff.css';

function StateBoundaryAdapter(props: Parameters<typeof StateBoundary>[0] & { enabled: boolean }) {
  const denied = props.state.status === 'forbidden' || props.state.status === 'session-expired';
  return props.enabled || denied ? <StateBoundary {...props} /> : <>{props.children}</>;
}
export function StaffCabinet({ session, role }: { session: SessionResponse; role: StaffRole }) {
  const { locale, t } = useLocale();
  const copy = useStaffCopy();
  const operator = role === 'TECH_OPERATOR';
  const director = role === 'DIRECTOR';
  const navigation = useStaffNavigation(role);
  const { section: tab, id } = navigation.route;
  const [data, setData] = useState<Workspace | null>(null);
  const timezone = data?.actorContext?.timezone;
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [health, setHealth] = useState<{ api: string; db: string; worker: string }>();
  const [reload, setReload] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [readStatus, setReadStatus] = useState<number | undefined>();
  const [readFailed, setReadFailed] = useState(false);
  const tooOld = useDataAge(updatedAt, 120_000);
  useContextRefresh({
    enabled: k8kEnabled,
    paused: loading || detailLoading,
    context: 'operational',
    refresh: async () => {
      setReload((value) => value + 1);
    },
  });
  useEffect(() => {
    const abort = new AbortController();
    const lease = sessionSignal();
    const discarded = () => abort.signal.aborted || lease.aborted;
    if (discarded()) return;
    setLoading(true);
    setError(false);
    if (operator)
      void currentSession(requestOptions(abort.signal)).then(async (current) => {
        if (discarded()) return;
        if (
          !current.ok ||
          current.value.account.id !== session.account.id ||
          current.value.account.roles[0] !== role ||
          current.value.recovery_only ||
          !(current.value.mfa_completed || current.value.password_only)
        ) {
          if (current.ok || current.error.status === 401) return leaveSession('/');
          if (current.error.status === 403) {
            setHealth(undefined);
            setUpdatedAt(0);
          }
          setReadFailed(true);
          setReadStatus(current.error.status);
          setLoading(false);
          return;
        }
        const r = await getComponentStatus(requestOptions(abort.signal));
        if (discarded()) return;
        if (!r.ok && r.error.status === 401) return leaveSession('/account');
        if (r.ok) {
          setHealth(r.value);
          setUpdatedAt(Date.now());
          setReadStatus(undefined);
          setReadFailed(false);
        } else {
          if (r.error.status === 403) {
            setHealth(undefined);
            setUpdatedAt(0);
          }
          setReadFailed(true);
          setReadStatus(r.error.status);
          setError(true);
        }
        setLoading(false);
      });
    else
      void getPlatformWorkspace(requestOptions(abort.signal)).then((r) => {
        if (discarded()) return;
        if (r.ok) {
          if (
            r.value.actorContext &&
            (r.value.actorContext.accountId !== session.account.id ||
              r.value.actorContext.role !== role)
          )
            return leaveSession('/');
          setData(r.value);
          setUpdatedAt(Date.now());
          setReadStatus(undefined);
          setReadFailed(false);
        } else if (r.error.status === 401) {
          return leaveSession('/account');
        } else {
          if (r.error.status === 403) setData(null);
          setReadFailed(true);
          setReadStatus(r.error.status);
          setError(true);
        }
        setLoading(false);
      });
    return () => abort.abort();
  }, [operator, reload, role, session.account.id]);
  const name =
    (readStatus === 401 || readStatus === 403 ? undefined : data?.name) ??
    accountRoleLabel(locale, role);
  const tabs = roleNavigation[operator ? 'TECH_OPERATOR' : director ? 'DIRECTOR' : 'TEACHER'];
  const selectedTab = tabs.find(({ id }) => id === tab);
  const content = (
    <>
      <div className="page-heading">
        <div>
          <h1 ref={navigation.heading} tabIndex={-1}>
            {tab === 'overview' && data && !operator
              ? `${copy('greeting')}, ${name.replace('[ДЕМО] ', '').split(' ')[0]}`
              : selectedTab && t(selectedTab.labelKey)}
          </h1>
          {tab === 'overview' && (
            <p className="muted">
              {copy(director ? 'directorIntro' : operator ? 'operatorIntro' : 'teacherIntro')}
            </p>
          )}
        </div>
        <button
          type="button"
          className="refresh"
          aria-disabled={loading || detailLoading}
          onClick={() => {
            if (!loading && !detailLoading) setReload((value) => value + 1);
          }}
        >
          {loading || detailLoading ? t('refreshing') : copy('update')}
        </button>
      </div>
      {!k8kEnabled && error && (
        <p role="alert" className="error">
          {copy('readFailed')}
        </p>
      )}
      {!k8kEnabled && loading && !data && <p role="status">{t('loading')}</p>}
      {id !== null && tab !== 'overview' && (
        <StaffDetail
          key={tab + ':' + id}
          section={tab}
          id={id}
          role={role}
          accountId={session.account.id}
          reload={reload}
          onReading={setDetailLoading}
          navigation={navigation}
        />
      )}
      {id === null && (
        <StateBoundaryAdapter
          enabled={k8kEnabled}
          state={queryBoundaryState({
            isPending: loading,
            hasData: operator ? updatedAt > 0 : !!data,
            error: readFailed,
            errorStatus: readStatus,
            tooOld,
          })}
          receivedAt={updatedAt}
          asOf={data?.actorContext?.asOf}
          refreshing={loading}
          retryRead={() => setReload((value) => value + 1)}
        >
          {operator ? (
            <section className="panel">
              <h2>{t('health')}</h2>
              {health && (
                <p role="status">
                  API: {health.api} · {copy('database')}: {health.db} · Worker: {health.worker}
                </p>
              )}
            </section>
          ) : (
            data && <StaffWorkspace data={data} navigation={navigation} />
          )}
        </StateBoundaryAdapter>
      )}
    </>
  );
  if (k8kEnabled)
    return (
      <AppShell
        role={role}
        {...(timezone ? { timeZone: timezone } : {})}
        activeId={tab}
        mobileMore
        sidebarFooter={
          <details className="staff-help">
            <summary>{copy('help')}</summary>
            <p>{copy('helpText')}</p>
          </details>
        }
        renderNavigation={(item, label, props) => (
          <a
            className={props.className}
            aria-current={props['aria-current']}
            {...navigation.link(
              navigation.href(
                item.id as StaffSection,
                undefined,
                item.id === tab ? navigation.route.filter : '',
              ),
              false,
              props.onClick,
            )}
          >
            {label}
          </a>
        )}
        account={<AccountMenu name={name} role={role} />}
        footer={`K8K Academy · ${t('calendarZone')} ${timezone ?? '—'}`}
      >
        {content}
      </AppShell>
    );
  return (
    <div className="staff-app">
      <a className="skip" href="#content">
        {t('skip')}
      </a>
      <aside className="sidebar">
        <a className="brand" href={roleHome(role)}>
          a
          <span>
            Academy<small>{accountRoleLabel(locale, role)}</small>
          </span>
        </a>
        <p className="sidebar-label">{t('workspace')}</p>
        <nav aria-label={t('primaryNavigation')}>
          {tabs.map(({ id, labelKey }) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() =>
                navigation.navigate(
                  navigation.href(
                    id as StaffSection,
                    undefined,
                    id === tab ? navigation.route.filter : '',
                  ),
                )
              }
            >
              {t(labelKey)}
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          {t('chrome.staffNote')}
          <span>Academy · {t('chrome.school')}</span>
        </div>
      </aside>
      <div className="staff-main">
        <header className="topbar">
          <span>{t('auth.cabinet')}</span>
          <AccountMenu name={name} role={role} />
        </header>
        <main id="content" tabIndex={-1}>
          {content}
        </main>
        <footer>Academy · {t('calendarZone')} Europe/Chisinau</footer>
      </div>
    </div>
  );
}
