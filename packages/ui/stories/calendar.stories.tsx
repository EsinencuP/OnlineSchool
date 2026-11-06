import { useState } from 'react';
import { Calendar, DatePicker, Segmented } from '../src/index.js';
import type { CalendarEvent, CalendarView, Locale } from '../src/index.js';

export default { title: 'UI/Calendar and dates' };

const days = ['2026-10-25', '2026-10-26', '2026-10-27'];
const horizon = { from: '2026-10-24T21:00:00Z', to: '2026-10-27T22:00:00Z' };
const entries: Pick<CalendarEvent, 'startsAt' | 'endsAt' | 'state'>[] = [
  {
    startsAt: '2026-10-25T03:10:00+03:00',
    endsAt: '2026-10-25T03:50:00+03:00',
    state: 'protected',
  },
  {
    startsAt: '2026-10-25T03:10:00+02:00',
    endsAt: '2026-10-25T03:50:00+02:00',
    state: 'pending-renewal',
  },
  { startsAt: '2026-10-26T12:00:00+02:00', endsAt: '2026-10-26T13:00:00+02:00', state: 'busy' },
  { startsAt: '2026-10-26T14:00:00+02:00', endsAt: '2026-10-26T15:00:00+02:00', state: 'free' },
  { startsAt: '2026-10-26T16:00:00+02:00', endsAt: '2026-10-26T17:00:00+02:00', state: 'unknown' },
];

function Schedule({ locale, empty = false }: { locale: Locale; empty?: boolean }) {
  const ro = locale === 'ro';
  const [date, setDate] = useState('2026-10-25');
  const [view, setView] = useState<CalendarView>('day');
  const events = empty
    ? []
    : entries.map((entry, index) => ({
        ...entry,
        id: `fixture-${index}`,
        revision: null,
        title: ro
          ? 'Interval de timp sintetic cu o denumire lungă'
          : 'Синтетический интервал с длинным названием',
      }));
  return (
    <>
      <DatePicker
        label={ro ? 'Data locală' : 'Локальная дата'}
        value={date}
        onValueChange={setDate}
        min="2026-10-25"
        max="2026-10-28"
      />
      <Segmented
        label={ro ? 'Modul de afișare' : 'Режим просмотра'}
        value={view}
        onValueChange={(value) => setView(value as CalendarView)}
        options={[
          { value: 'day', label: ro ? 'Zi' : 'День' },
          { value: 'week', label: ro ? 'Săptămână' : 'Неделя' },
          { value: 'list', label: ro ? 'Listă' : 'Список' },
        ]}
      />
      <Calendar
        label={ro ? 'Calendar sintetic' : 'Синтетический календарь'}
        timeZone="Europe/Chisinau"
        view={view}
        days={view === 'day' ? [date] : days}
        horizon={horizon}
        events={events}
      />
    </>
  );
}
export const CalendarViews = { render: Schedule };
export const EmptyRange = { args: { empty: true }, render: Schedule };

export const MonthRange = {
  render: ({ locale }: { locale: Locale }) => (
    <Calendar
      label={locale === 'ro' ? 'Lună sintetică — octombrie' : 'Синтетический месяц — октябрь'}
      view="month"
      timeZone="Europe/Chisinau"
      days={Array.from({ length: 31 }, (_, day) => `2026-10-${String(day + 1).padStart(2, '0')}`)}
      horizon={horizon}
      events={entries.map((entry, index) => ({
        ...entry,
        id: `month-fixture-${index}`,
        revision: null,
        title:
          locale === 'ro'
            ? 'Interval sintetic din datele încărcate'
            : 'Синтетический загруженный интервал',
      }))}
    />
  ),
};
export const DisabledDate = {
  render: ({ locale }: { locale: Locale }) => (
    <DatePicker
      label={locale === 'ro' ? 'Dată indisponibilă' : 'Дата недоступна'}
      value="2026-10-25"
      onValueChange={() => {}}
      disabled
    />
  ),
};
