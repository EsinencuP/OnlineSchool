import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeLocale } from '@online-school/ui';
import { SessionExitBoundary } from '@online-school/account-ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './api.js';
import { router } from './router.js';
import './style.css';
import '@online-school/ui/style.css';
import './student.css';
initializeLocale();
const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <SessionExitBoundary>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </SessionExitBoundary>
    </StrictMode>,
  );
