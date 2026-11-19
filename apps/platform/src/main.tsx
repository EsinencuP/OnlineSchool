import { createRoot } from 'react-dom/client';
import { SessionExitBoundary } from '@online-school/account-ui';
import { initializeLocale } from '@online-school/ui';
import { CabinetApp } from './cabinet/CabinetApp.js';
import './cabinet/cabinet.css';

initializeLocale();
createRoot(document.getElementById('root')!).render(
  <SessionExitBoundary>
    <CabinetApp />
  </SessionExitBoundary>,
);
