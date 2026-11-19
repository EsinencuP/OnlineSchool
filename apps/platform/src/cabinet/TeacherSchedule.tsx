import { useEffect, useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { Calendar, Icon, calendarDate, useLocale } from '@online-school/ui';
import type { CalendarEvent } from '@online-school/ui';
import { request } from './contract.js';
import { CabinLink } from './Home.js';
import { teacherCopy } from './teacherCopy.js';

type Lesson = components['schemas']['TeacherTodayLessonDto'];
type Day = components['schemas']['TeacherTodayResponseDto'];

function schoolDay(zone: string) {
  const fields = new Intl.DateTimeFormat('en', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  const part = (type: string) => fields.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addDays(iso: string, delta: number) {
  const date = new Date(iso + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function monday(iso: string) {
  return addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7));
}

function calendarEvent(lesson: Lesson): CalendarEvent {
  return {
    id: lesson.lessonId,
    revision: null,
    startsAt: lesson.startsAt,
    endsAt: lesson.endsAt,
    title: `${lesson.subjectName} · ${lesson.studentName}`,
    state: lesson.status === 'STAR_PENDING' ? 'pending-renewal' : 'busy',
  };
}

function readWeek() {
  const date = calendarDate(new URLSearchParams(window.location.search).get('week') ?? '');
  return date && date >= '1900-01-01' && date < '9900-01-01' ? monday(date) : null;
}

export function weekSearch(week = readWeek()) {
  return week ? '?week=' + week : '';
}

export function TeacherSchedule({
  zone,
  navigate,
}: {
  zone: string;
  navigate: (url: string) => void;
}) {
  const { locale } = useLocale();
  const t = teacherCopy[locale];
  const [week, setWeek] = useState(readWeek);
  const [attempt, setAttempt] = useState(0);
  const thisWeek = monday(schoolDay(zone));
  const from = week ?? thisWeek;
  const days = Array.from({ length: 7 }, (_, index) => addDays(from, index));
  function move(nextWeek: string | null) {
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + weekSearch(nextWeek),
    );
    setWeek(nextWeek);
  }
  const [loaded, setLoaded] = useState<{ from: string; attempt: number; days: Day[] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    void Promise.allSettled(
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(from, index);
        return request<Day>('getTeacherToday', { query: { date }, signal }).then((day) =>
          day.date === date && Array.isArray(day.lessons) ? day : null,
        );
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const complete = results.flatMap((day) =>
        day.status === 'fulfilled' && day.value ? [day.value] : [],
      );
      setLoaded({ from, attempt, days: complete });
    });
    return () => controller.abort();
  }, [from, attempt]);

  const current = loaded?.from === from && loaded.attempt === attempt ? loaded : null;
  const events =
    current?.days
      .flatMap((entry) => entry.lessons)
      .filter((lesson) => lesson.status !== 'CANCELLED')
      .map(calendarEvent) ?? [];

  return (
    <section className="cab-card cab-panel cab-teacher-week">
      <div className="cab-panel-title">
        <h2>{t.schedule}</h2>
        <div className="cab-calendar-controls">
          <button
            type="button"
            className="cab-button cab-secondary"
            aria-label={t.previous}
            onClick={() => move(addDays(from, -7))}
          >
            ‹
          </button>
          <button type="button" className="cab-button cab-secondary" onClick={() => move(null)}>
            {t.today}
          </button>
          <button
            type="button"
            className="cab-button cab-secondary"
            aria-label={t.next}
            onClick={() => move(addDays(from, 7))}
          >
            ›
          </button>
        </div>
      </div>
      {current ? (
        <>
          {current.days.length < 7 && (
            <div className="cab-empty cab-empty-error" role="status">
              <span>{t.calendarIncomplete}</span>
              <button
                className="cab-text-button"
                type="button"
                onClick={() => setAttempt(attempt + 1)}
              >
                {t.retry}
              </button>
            </div>
          )}
          <Calendar
            label={t.schedule}
            timeZone={zone}
            view="week"
            days={days}
            horizon={
              current.days.length === 7
                ? { from: addDays(from, -1) + 'T00:00:00Z', to: addDays(from, 8) + 'T00:00:00Z' }
                : null
            }
            events={events}
            renderEvent={(event) => (
              <CabinLink
                className="cab-inline-link"
                to={'/teacher/lessons/' + encodeURIComponent(event.id) + weekSearch(week)}
                navigate={navigate}
              >
                {event.title} <Icon name="arrow" size={14} />
              </CabinLink>
            )}
          />
        </>
      ) : (
        <div className="cab-empty" role="status">
          {t.loading}
        </div>
      )}
    </section>
  );
}
