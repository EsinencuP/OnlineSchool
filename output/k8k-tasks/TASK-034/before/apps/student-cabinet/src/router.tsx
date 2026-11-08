import { Reports } from './pages/Reports.js';
import {
  createBrowserRouter,
  Navigate,
  Link,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router-dom';
import { useEffect, useRef } from 'react';
import type { Location } from 'react-router-dom';
import { k8kEnabled, useLocale } from '@online-school/ui';
import { setRedirect } from './api.js';
import { StudentLayout } from './Layout.js';
import { Dashboard } from './pages/Dashboard.js';
import { Lessons, LessonDetail } from './pages/Lessons.js';
import { Homework, HomeworkDetail } from './pages/Homework.js';
import { SkillMap, Materials, Notifications } from './pages/Learning.js';
import { Subscription } from './pages/Subscription.js';
import { AccessSuspended, ChangePassword, Login, Profile, Security } from './pages/Account.js';
import { StudentHelp, StudentSubjects } from './pages/Subjects.js';

function scrollKey(location: Location) {
  if (
    location.pathname !== '/student/subjects' &&
    location.pathname !== '/student/lessons' &&
    location.pathname !== '/student/homework' &&
    location.pathname !== '/student/reports'
  )
    return location.key;
  const params = new URLSearchParams(location.search);
  params.delete('ui.k8k');
  return `${location.pathname}?${params}`;
}

function Root() {
  const { t } = useLocale();
  const navigate = useNavigate(),
    location = useLocation(),
    main = useRef<HTMLDivElement>(null);
  setRedirect((path) => {
    if (location.pathname !== path) void navigate(path, { replace: true });
  });
  useEffect(() => {
    const page =
      location.pathname === '/student'
        ? t('home')
        : location.pathname === '/student/subjects'
          ? t('nav.studentSubjects')
          : location.pathname === '/student/help'
            ? t('nav.studentHelp')
            : t('cabinetStudent');
    document.title = `${page} — ${k8kEnabled ? 'K8K Academy' : 'Academy'}`;
  }, [location.pathname, t]);
  useEffect(() => {
    if (!k8kEnabled || !document.querySelector('.k8k-main')) main.current?.focus();
  }, [location.pathname]);
  return (
    <div ref={main} tabIndex={-1}>
      <Outlet />
      {k8kEnabled && <ScrollRestoration getKey={scrollKey} />}
    </div>
  );
}
function RouteError() {
  const error = useRouteError();
  return (
    <main className="standalone">
      <h1>
        {error && typeof error === 'object' && 'status' in error && error.status === 404
          ? 'Страница не найдена'
          : 'Не удалось открыть страницу'}
      </h1>
      <Link to="/student">Вернуться в кабинет</Link>
    </main>
  );
}
function LegacyNotificationRedirect() {
  const { search } = useLocation();
  const next = new URLSearchParams(search);
  next.set('events', '1');
  return <Navigate replace to={'/student?' + next} />;
}
export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { path: '/student/login', element: <Login /> },
      { path: '/student/suspended', element: <AccessSuspended /> },
      { path: '/student/security/change-password', element: <ChangePassword /> },
      {
        element: <StudentLayout />,
        children: [
          { path: '/student', element: <Dashboard /> },
          { path: '/student/lessons', element: <Lessons /> },
          { path: '/student/lessons/:id', element: <LessonDetail /> },
          { path: '/student/homework', element: <Homework /> },
          { path: '/student/homework/:id', element: <HomeworkDetail /> },
          {
            path: '/student/subjects',
            element: k8kEnabled ? <StudentSubjects /> : <Navigate to="/student" replace />,
          },
          {
            path: '/student/help',
            element: k8kEnabled ? <StudentHelp /> : <Navigate to="/student" replace />,
          },
          { path: '/student/skills', element: <SkillMap /> },
          { path: '/student/reports', element: <Reports /> },
          { path: '/student/materials', element: <Materials /> },
          { path: '/student/subscription', element: <Subscription /> },
          {
            path: '/student/notifications',
            element: k8kEnabled ? <LegacyNotificationRedirect /> : <Notifications />,
          },
          { path: '/student/profile', element: <Profile /> },
          { path: '/student/security', element: <Security /> },
        ],
      },
    ],
  },
]);
