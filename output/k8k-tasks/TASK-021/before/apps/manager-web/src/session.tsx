import { createContext, useContext, useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { leaveSession, SessionExitBoundary } from '@online-school/account-ui';
import { useQuery } from '@tanstack/react-query';
import { getManagerMe } from '@online-school/api-contracts';
import type { ManagerMeResponseDto } from '@online-school/api-contracts';
import type { ApiErrorView } from './api/error-view.js';
import { queryClient, read } from './api/client.js';
import { ErrorBox } from './components/ui.js';
import { ru } from './i18n/ru.js';
import { MANAGER_ROUTES } from './routes.js';
const SessionContext = createContext<ManagerMeResponseDto | null>(null);
export function useManager() {
  return useContext(SessionContext)!;
}
export function SessionBoundary() {
  return (
    <SessionExitBoundary>
      <Outlet />
    </SessionExitBoundary>
  );
}
export function RequireManager() {
  const query = useQuery<ManagerMeResponseDto, ApiErrorView>({
    queryKey: ['manager', 'me'],
    queryFn: ({ signal }) => read(getManagerMe, signal),
  });
  const account = useRef<string>();
  const accountId = query.data?.actorContext?.accountId;
  const replaced = !!account.current && !!accountId && account.current !== accountId;
  const denied = query.error?.status === 403;
  useEffect(() => {
    if (replaced) leaveSession('/');
    else if (accountId) account.current = accountId;
  }, [accountId, replaced]);
  useEffect(() => {
    if (!denied) return;
    const privateQueries = {
      predicate: (q: { queryKey: readonly unknown[] }) =>
        q.queryKey[0] !== 'manager' || q.queryKey[1] !== 'me',
    };
    void queryClient.cancelQueries(privateQueries, { silent: true });
    queryClient.removeQueries(privateQueries);
    queryClient.getMutationCache().clear();
  }, [denied]);
  if (replaced) return null;
  if (query.isPending)
    return (
      <div className="auth-shell">
        <p role="status">{ru.loading}</p>
      </div>
    );
  if (query.error?.status === 401) return <Navigate to={MANAGER_ROUTES.login} replace />;
  if (query.error?.status === 403)
    return (
      <main className="auth-shell">
        <h1>{ru.noAccess}</h1>
        <p>{ru.noAccessHelp}</p>
        <ErrorBox error={query.error} />
        <a href={MANAGER_ROUTES.login}>{ru.backLogin}</a>
      </main>
    );
  if (query.error)
    return (
      <main className="auth-shell">
        <ErrorBox
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </main>
    );
  return query.data ? (
    <SessionContext.Provider value={query.data}>
      <Outlet />
    </SessionContext.Provider>
  ) : null;
}
