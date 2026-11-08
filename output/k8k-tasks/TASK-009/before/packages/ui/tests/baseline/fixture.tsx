// Test entry only. No cabinet imports this fixture; no business/API commands.
import { createRoot } from 'react-dom/client';
import { AppShell, LanguageSelector, StateBoundary, useLocale } from '../../src/index.js';
import type { BoundaryState, CabinetRole } from '../../src/index.js';
import '../../src/style.css';
const params = new URLSearchParams(location.search);
const status = params.get('state') ?? 'ready';
const states: Record<string, BoundaryState> = {
  loading: { status: 'loading' },
  empty: { status: 'empty' },
  ready: { status: 'ready' },
  stale: { status: 'stale' },
  error: { status: 'error' },
  pending: { status: 'pending', outcome: 'pending' },
  unknown: { status: 'pending', outcome: 'unknown' },
  forbidden: { status: 'forbidden' },
  limited: {
    status: 'subscription-limited',
    message: 'ТЕСТ: ограничение только этого предмета / Limitare numai pentru această disciplină',
  },
  expired: { status: 'session-expired' },
};
function Fixture() {
  const { locale } = useLocale();
  const label =
    locale === 'ro'
      ? 'Etichetă sintetică foarte lungă pentru verificarea lizibilității și a navigării de la tastatură'
      : 'Очень длинная синтетическая подпись для проверки читаемости и навигации с клавиатуры';
  return (
    <AppShell
      role={(params.get('role') ?? 'STUDENT') as CabinetRole}
      activeId="overview"
      renderNavigation={(item, text, props) => (
        <a href={`#${item.id}`} {...props}>
          {text}
        </a>
      )}
      account={<span>TEST synthetic account</span>}
    >
      <h1>
        {locale === 'ro' ? 'Stări sintetice ale interfeței' : 'Синтетические состояния интерфейса'}
      </h1>
      <LanguageSelector />
      <StateBoundary
        state={states[status] ?? states.ready!}
        at={Date.parse('2026-11-03T10:30:30Z')}
        retryRead={() => undefined}
      >
        <p>SYNTHETIC_PRIVATE_MARKER</p>
        <label>
          {label}
          <input aria-label={label} defaultValue={label} />
        </label>
        <button type="button">{label}</button>
      </StateBoundary>
    </AppShell>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
