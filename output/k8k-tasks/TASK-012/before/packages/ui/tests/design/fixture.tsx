// Synthetic UI-only fixture; no user data, API commands or providers.
import { createRoot } from 'react-dom/client';
import { Button, Field, Icon, StateBoundary, StatusChip } from '../../src/index.js';
import type { BoundaryState } from '../../src/index.js';
import '../../src/style.css';
import './style.css';
const params = new URLSearchParams(location.search);
const ro = params.get('locale') === 'ro';
document.documentElement.lang = ro ? 'ro' : 'ru';
const role = params.get('role') === 'manager' ? 'manager' : 'student';
const label = ro
  ? 'Etichetă sintetică foarte lungă pentru verificarea citirii și navigării de la tastatură'
  : 'Очень длинная синтетическая подпись для проверки читаемости и навигации с клавиатуры';
const states: BoundaryState[] = [
  { status: 'loading' },
  { status: 'empty' },
  { status: 'ready' },
  { status: 'stale' },
  { status: 'error' },
  { status: 'pending', outcome: 'pending' },
  { status: 'pending', outcome: 'unknown' },
  { status: 'forbidden' },
  {
    status: 'subscription-limited',
    message: ro
      ? 'Limitare sintetică pentru o disciplină'
      : 'Синтетическое ограничение одного предмета',
  },
  { status: 'session-expired' },
];
createRoot(document.getElementById('root')!).render(
  <main className={`design-page k8k-role-${role}`}>
    <h1>
      {ro ? 'Contractul culorilor — date sintetice' : 'Контракт цветов — синтетические данные'}
    </h1>
    <p>{label}</p>
    {['white', 'page', 'sand', 'warm'].map((surface) => (
      <section key={surface} className={`design-surface design-${surface}`}>
        <h2>{surface}</h2>
        <div className="k8k-state-message design-links">
          <a href="#states" data-surface={surface}>
            {ro ? 'Deschide stările' : 'Открыть состояния'}
          </a>
        </div>
        <div className="design-controls">
          <Button data-primary={surface}>
            <Icon name="check" />
            {label}
          </Button>
          <Button variant="secondary">{ro ? 'Acțiune secundară' : 'Вторичное действие'}</Button>
          <Button variant="danger">{ro ? 'Anulează' : 'Отменить'}</Button>
          <Button disabled>{ro ? 'Indisponibil — explicație' : 'Недоступно — пояснение'}</Button>
          <Button pending>{ro ? 'Se așteaptă răspunsul' : 'Ожидается ответ'}</Button>
        </div>
        <Field
          label={ro ? 'Câmp sintetic' : 'Синтетическое поле'}
          error={ro ? 'Verificați valoarea introdusă' : 'Проверьте введённое значение'}
        />
        <div className="design-controls">
          {(['info', 'success', 'warning', 'danger'] as const).map((tone) => (
            <StatusChip key={tone} tone={tone}>
              {tone}: {ro ? 'stare sintetică' : 'синтетический статус'}
            </StatusChip>
          ))}
        </div>
      </section>
    ))}
    <section id="states">
      <h2>{ro ? 'Stările componentei existente' : 'Состояния существующего компонента'}</h2>
      {states.map((state, i) => (
        <section key={i} className="design-state">
          <h3>
            {state.status}
            {state.status === 'pending' ? ` / ${state.outcome}` : ''}
          </h3>
          <StateBoundary
            state={state}
            timeZone="Europe/Chisinau"
            at={Date.parse('2026-11-03T10:30:30Z')}
            retryRead={() => undefined}
          >
            <p>{label}</p>
          </StateBoundary>
        </section>
      ))}
    </section>
  </main>,
);
