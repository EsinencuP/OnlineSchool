import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Button, Calendar, DatePicker, Field, useLocale } from '@online-school/ui';
import type { CalendarEvent } from '@online-school/ui';
import Schedule from '../../src/pages/Schedule.js';
import { RequireManager, SessionBoundary } from '../../src/session.js';
import { queryClient } from '../../src/api/client.js';
import { localToIso } from '../../src/lib/time.js';
import { Lessons } from '../../../student-cabinet/src/pages/Lessons.js';
import '../../src/style.css';
import '@online-school/ui/style.css';
import './fixture.css';

const days = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
const horizon = { from: '2026-10-23T21:00:00Z', to: '2026-10-26T22:00:00Z' };
const events: CalendarEvent[] = [
  {
    id: 'protected',
    revision: 7,
    startsAt: '2026-10-25T00:30:00Z',
    endsAt: '2026-10-25T00:50:00Z',
    title: 'Fixture A',
    state: 'protected',
  },
  {
    id: 'renewal',
    revision: 9,
    startsAt: '2026-10-25T01:30:00Z',
    endsAt: '2026-10-25T01:50:00Z',
    title: 'Fixture B',
    state: 'pending-renewal',
  },
  {
    id: 'busy',
    revision: null,
    startsAt: '2026-10-25T11:00:00Z',
    endsAt: '2026-10-25T12:00:00Z',
    title: 'Fixture C',
    state: 'busy',
  },
  {
    id: 'free',
    revision: 1,
    startsAt: '2026-10-25T13:00:00Z',
    endsAt: '2026-10-25T14:00:00Z',
    title: 'Fixture D',
    state: 'free',
  },
  {
    id: 'boundary',
    revision: 1,
    startsAt: '2026-10-26T21:45:00Z',
    endsAt: '2026-10-26T22:15:00Z',
    title: 'Fixture E',
    state: 'free',
  },
  {
    id: 'outside',
    revision: 1,
    startsAt: '2026-10-26T22:00:00Z',
    endsAt: '2026-10-26T23:00:00Z',
    title: 'Fixture outside',
    state: 'free',
  },
];

function CalendarFixture() {
  const { locale } = useLocale();
  const ro = locale === 'ro';
  const [date, setDate] = useState('2026-10-25');
  const [zone, setZone] = useState('Europe/Chisinau');
  const [wallTime, setWallTime] = useState('2026-10-25T03:30');
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const refresh = () => setRefreshing((value) => !value);
    globalThis.addEventListener('fixture:refresh', refresh);
    return () => globalThis.removeEventListener('fixture:refresh', refresh);
  }, []);
  const instant = localToIso(wallTime, 'Europe/Chisinau');
  return (
    <>
      <h1>{ro ? 'Calendar de test' : 'Календарь для проверки'}</h1>
      <DatePicker
        id="validity"
        label={ro ? 'Data valabilității' : 'Дата действия'}
        value={date}
        onValueChange={setDate}
      />
      <Button
        data-zone
        onClick={() => setZone(zone === 'Europe/Chisinau' ? 'Pacific/Honolulu' : 'Europe/Chisinau')}
      >
        {ro ? 'Schimbă fusul orar' : 'Сменить часовой пояс'}
      </Button>
      <Field
        id="wall-time"
        type="datetime-local"
        label={ro ? 'Ora locală în Chișinău' : 'Местное время в Кишинёве'}
        value={wallTime}
        onChange={(event) => setWallTime(event.target.value)}
      />
      <output data-instant data-valid={!!instant}>
        {instant ??
          (ro ? 'Ora este ambiguă sau nu există.' : 'Время неоднозначно или отсутствует.')}
      </output>
      <Calendar
        label={ro ? 'Evenimente de test' : 'События для проверки'}
        timeZone={zone}
        view="week"
        days={days}
        horizon={horizon}
        events={events}
        refreshing={refreshing}
      />
    </>
  );
}

globalThis.addEventListener('fixture:refetch-schedule', () => {
  void queryClient.invalidateQueries({ queryKey: ['manager', 'schedule'] });
});
createRoot(globalThis.document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <main className="calendar-fixture k8k-role-manager">
        <Routes>
          <Route path="/" element={<CalendarFixture />} />
          <Route element={<SessionBoundary />}>
            <Route element={<RequireManager />}>
              <Route path="/manager/schedule" element={<Schedule />} />
            </Route>
          </Route>
          <Route path="/student/lessons" element={<Lessons />} />
        </Routes>
      </main>
    </BrowserRouter>
  </QueryClientProvider>,
);
