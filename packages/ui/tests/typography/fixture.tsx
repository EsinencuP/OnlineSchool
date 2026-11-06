// Local-only synthetic specimen. Never imports cabinet APIs or user data.
import { createRoot } from 'react-dom/client';
import { Avatar, Button, Icon, IconButton, StateBoundary, StatusChip } from '../../src/index.js';
import type { BoundaryState } from '../../src/index.js';
import '../../src/style.css';
import './style.css';
const params = new URLSearchParams(location.search);
const ro = params.get('locale') === 'ro';
const role = params.get('role') === 'manager' ? 'manager' : 'student';
globalThis.document.documentElement.lang = ro ? 'ro' : 'ru';
const longName = ro
  ? 'Ăna Ștefănescu-' + 'Numefoartelung'.repeat(14)
  : 'Анна ' + 'Оченьдлиннаяфамилия'.repeat(14);
const label = ro ? 'Deschide orarul' : 'Открыть расписание';
const text = ro
  ? 'Știință și învățare: ș ț ă â î — Ș Ț Ă Â Î'
  : 'Учёба и чтение: Ё ё Й й Ж ж — длинная строка';
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
    message: ro ? 'Limitare sintetică' : 'Синтетическое ограничение',
  },
  { status: 'session-expired' },
];
createRoot(globalThis.document.getElementById('root')!).render(
  <main className={`specimen k8k-role-${role}`}>
    <h1 className="k8k-heading-1">
      {ro ? 'Tipografie — date sintetice' : 'Типографика — синтетические данные'}
    </h1>
    <p className="k8k-body">{text}</p>
    <section className="k8k-card">
      <h2>{ro ? 'Alfabet și cifre' : 'Алфавит и цифры'}</h2>
      <p id="glyph-ro" className="k8k-body">
        șțăâîȘȚĂÂÎ
      </p>
      <p id="glyph-ru" className="k8k-body">
        ЁёЖжЯяЙй
      </p>
      <p id="glyph-nfd" className="k8k-body">
        {'s\u0326 t\u0326 a\u0306'}
      </p>
      <p className="k8k-data" id="numbers">
        1 111,00 MDL · 2 222,00 EUR · 00:00 · 88:88
      </p>
      <div className="specimen-person">
        <Avatar name={longName} />
        <span className="k8k-person-name k8k-data">{longName}</span>
      </div>
      <div className="specimen-actions">
        <IconButton label={label}>
          <Icon name="calendar" />
        </IconButton>
        <Button>
          <Icon name="check" />
          {label}
        </Button>
        <StatusChip tone="success">{ro ? 'Stare sintetică' : 'Синтетический статус'}</StatusChip>
      </div>
    </section>
    <section className="k8k-card">
      <h2>{ro ? 'Scara fontului' : 'Шкала шрифта'}</h2>
      {['xs', 'sm', 'body', 'lg', 'xl', '2xl', '3xl'].map((size) => (
        <p key={size} data-scale={size} className={`specimen-${size}`}>
          {text}
        </p>
      ))}
    </section>
    <section className="k8k-card">
      <h2>{ro ? 'Stări existente' : 'Существующие состояния'}</h2>
      {states.map((state, i) => (
        <section key={i}>
          <h3 className="k8k-heading-3">
            {state.status}
            {state.status === 'pending' ? `/${state.outcome}` : ''}
          </h3>
          <StateBoundary
            state={state}
            at={Date.parse('2026-11-03T10:30:00Z')}
            timeZone="Europe/Chisinau"
            retryRead={() => undefined}
          >
            <p className="k8k-data">{text}</p>
          </StateBoundary>
        </section>
      ))}
    </section>
  </main>,
);
