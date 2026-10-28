import {
  createBrowserRouter,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { setRedirect } from './api.js';
import { StudentLayout } from './Layout.js';
import { Dashboard } from './pages/Dashboard.js';
import { Lessons, LessonDetail } from './pages/Lessons.js';
import { Homework, HomeworkDetail } from './pages/Homework.js';
import { SkillMap, Materials, Notifications, Subscription } from './pages/Learning.js';
import { AccessSuspended, ChangePassword, Login, Profile, Security } from './pages/Account.js';
function Root() {
  const navigate = useNavigate(),
    location = useLocation(),
    main = useRef<HTMLDivElement>(null);
  setRedirect((path) => {
    if (location.pathname !== path) void navigate(path, { replace: true });
  });
  useEffect(() => {
    document.title = `${location.pathname === '/student' ? 'Главная' : 'Кабинет ученика'} — Academy`;
    main.current?.focus();
  }, [location.pathname]);
  return (
    <div ref={main} tabIndex={-1}>
      <Outlet />
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
          { path: '/student/skills', element: <SkillMap /> },
          { path: '/student/materials', element: <Materials /> },
          { path: '/student/subscription', element: <Subscription /> },
          { path: '/student/notifications', element: <Notifications /> },
          { path: '/student/profile', element: <Profile /> },
          { path: '/student/security', element: <Security /> },
        ],
      },
    ],
  },
]);
