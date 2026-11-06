import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeLocale } from '@online-school/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { queryClient } from './api/client.js';
import { SessionBoundary, RequireManager } from './session.js';
import { Layout } from './components/layout.js';
import { ErrorBoundary } from './components/error-boundary.js';
import { ru } from './i18n/ru.js';
import './style.css';
import '@online-school/ui/style.css';
const Login = lazy(() => import('./pages/Login.js'));
const Dashboard = lazy(() => import('./pages/Dashboard.js'));
const Students = lazy(() => import('./pages/Students.js'));
const Student = lazy(() => import('./pages/Student.js'));
const Account = lazy(() => import('./pages/Account.js'));
const Schedule = lazy(() => import('./pages/Schedule.js'));
const Tasks = lazy(() => import('./pages/Tasks.js'));
const Task = lazy(() => import('./pages/Task.js'));
const Leads = lazy(() => import('./pages/Leads.js'));
const Lead = lazy(() => import('./pages/Lead.js'));
initializeLocale();
if (import.meta.env.MODE === 'mock') await (await import('./test/browser.js')).startMocks();
// BFCache must not restore a privileged screen or an aborted one-time-secret command.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense
            fallback={
              <p className="state" role="status">
                {ru.loading}
              </p>
            }
          >
            <Routes>
              <Route element={<SessionBoundary />}>
                <Route path="/manager/login" element={<Login />} />
                <Route element={<RequireManager />}>
                  <Route element={<Layout />}>
                    <Route path="/manager" element={<Dashboard />} />
                    <Route path="/manager/leads" element={<Leads />} />
                    <Route path="/manager/leads/:id" element={<Lead />} />
                    <Route path="/manager/students" element={<Students />} />
                    <Route path="/manager/students/:id" element={<Student />} />
                    <Route path="/manager/students/:id/account" element={<Account />} />
                    <Route path="/manager/schedule" element={<Schedule />} />
                    <Route path="/manager/tasks" element={<Tasks />} />
                    <Route path="/manager/tasks/:id" element={<Task />} />
                  </Route>
                </Route>
                <Route
                  path="*"
                  element={
                    <main className="auth-shell">
                      <h1>{ru.notFound}</h1>
                      <a href="/manager">{ru.dashboard}</a>
                    </main>
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
);
