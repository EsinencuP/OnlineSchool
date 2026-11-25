import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const CABINETS = [
  {
    to: '/manager',
    title: 'Менеджер',
    tone: 'tile-yellow',
    who: 'Кристина Делеу',
    points: ['Воронка заявок и пробные уроки', 'Ученики, абонементы, заморозки', 'Очередь задач и спорные списания', 'Расписание и платежи'],
  },
  {
    to: '/teacher',
    title: 'Преподаватель',
    tone: 'tile-teal',
    who: 'Елена Морозан',
    points: ['Уроки дня и журнал за 24 часа', 'Проверка заданий и карта навыков', 'Контрольные точки 4 / 8 уроков', 'Доступность, запросы и начисления'],
  },
  {
    to: '/student',
    title: 'Ученик',
    tone: 'tile-blue',
    who: 'Даниэла Ботнару',
    points: ['Ближайший урок и вход в Meet', 'Задания с версиями и комментариями', 'Навыки, цели и отчёты', 'Абонементы и уведомления'],
  },
];

/** Demo entry: no login in this build, pick a cabinet to explore its design. */
export function RolePicker() {
  return (
    <div style={{ minHeight: '100%', padding: '40px 16px', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 'min(1120px, 100%)', display: 'grid', gap: 28 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <img src="/logo.svg" alt="2K Academy" style={{ height: 64 }} />
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-.02em' }}>Кабинеты платформы</h1>
            <p className="muted">Демо без входа: данные синтетические и хранятся в памяти браузера. Формат данных совпадает с API /api/v1.</p>
          </div>
        </header>
        <div className="pick">
          {CABINETS.map((c) => (
            <Link key={c.to} to={c.to} className={`pick-card ${c.tone}`} style={{ color: 'inherit' }}>
              <span className="muted" style={{ fontSize: 13 }}>{c.who}</span>
              <h2>{c.title}</h2>
              <ul>
                {c.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <span className="btn btn-dark btn-sm go">
                Открыть <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
