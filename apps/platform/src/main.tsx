import { createRoot } from 'react-dom/client';
import { initializeLocale } from '@online-school/ui';
import { App } from './App.js';
import './style.css';
import '@online-school/ui/style.css';
import '@online-school/account-ui/style.css';
initializeLocale();
createRoot(document.getElementById('root')!).render(<App />);
