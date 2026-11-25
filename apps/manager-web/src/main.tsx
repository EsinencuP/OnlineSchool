import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ManagerLayout } from './manager/Layout';
import { Dashboard } from './manager/pages/Dashboard';
import { Leads } from './manager/pages/Leads';
import { Payments } from './manager/pages/Payments';
import { Schedule } from './manager/pages/Schedule';
import { Students } from './manager/pages/Students';
import { Tasks } from './manager/pages/Tasks';
import { ManagerStoreProvider } from './manager/store';
import { RolePicker } from './RolePicker';
import { StudentLayout } from './student/Layout';
import { StudentHome } from './student/pages/Home';
import { StudentHomework } from './student/pages/Homework';
import { StudentLessons } from './student/pages/Lessons';
import { StudentMaterials, StudentNotifications, StudentReports, StudentSubscription } from './student/pages/More';
import { StudentProgress } from './student/pages/Progress';
import { StudentStoreProvider } from './student/store';
import { TeacherLayout } from './teacher/Layout';
import { TeacherJournal } from './teacher/pages/Journal';
import { TeacherSchedule } from './teacher/pages/Schedule';
import { TeacherStudents } from './teacher/pages/Students';
import { TeacherToday } from './teacher/pages/Today';
import { TeacherCheckpoints, TeacherHomework, TeacherMaterials, TeacherPayroll } from './teacher/pages/Work';
import { TeacherStoreProvider } from './teacher/store';
import './styles.css';

const router = createBrowserRouter([
  { path: '/', element: <RolePicker /> },
  {
    path: '/manager',
    element: <ManagerLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'leads', element: <Leads /> },
      { path: 'students', element: <Students /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'schedule', element: <Schedule /> },
      { path: 'payments', element: <Payments /> },
    ],
  },
  {
    path: '/teacher',
    element: <TeacherLayout />,
    children: [
      { index: true, element: <TeacherToday /> },
      { path: 'schedule', element: <TeacherSchedule /> },
      { path: 'journal', element: <TeacherJournal /> },
      { path: 'students', element: <TeacherStudents /> },
      { path: 'homework', element: <TeacherHomework /> },
      { path: 'checkpoints', element: <TeacherCheckpoints /> },
      { path: 'materials', element: <TeacherMaterials /> },
      { path: 'payroll', element: <TeacherPayroll /> },
    ],
  },
  {
    path: '/student',
    element: <StudentLayout />,
    children: [
      { index: true, element: <StudentHome /> },
      { path: 'lessons', element: <StudentLessons /> },
      { path: 'homework', element: <StudentHomework /> },
      { path: 'progress', element: <StudentProgress /> },
      { path: 'reports', element: <StudentReports /> },
      { path: 'materials', element: <StudentMaterials /> },
      { path: 'subscription', element: <StudentSubscription /> },
      { path: 'notifications', element: <StudentNotifications /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

/** All cabinet stores live at the root, so switching cabinets keeps demo changes. */
function Root() {
  return (
    <ManagerStoreProvider>
      <TeacherStoreProvider>
        <StudentStoreProvider>
          <RouterProvider router={router} />
        </StudentStoreProvider>
      </TeacherStoreProvider>
    </ManagerStoreProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

