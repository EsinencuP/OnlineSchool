import { useEffect, useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { calendarDate, useLocale } from '@online-school/ui';
import { request } from './contract.js';
import { addDays, monday, scheduleDate, StaffSchedule } from './StaffSchedule.js';
import type { ScheduleLesson } from './StaffSchedule.js';
import { teacherCopy } from './teacherCopy.js';

type Lesson = components['schemas']['TeacherTodayLessonDto'];
type Day = components['schemas']['TeacherTodayResponseDto'];

function calendarEvent(lesson: Lesson): ScheduleLesson {
  return {
    id: lesson.lessonId,
    startsAt: lesson.startsAt,
    endsAt: lesson.endsAt,
    title: lesson.subjectName,
    person: lesson.studentName,
    status: lesson.status,
    trial: lesson.kind === 'TRIAL',
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
  const thisWeek = monday(scheduleDate(new Date(), zone));
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

  const unavailableDays = current
    ? days.filter((date) => !current.days.some((day) => day.date === date))
    : [];
  return (
    <StaffSchedule
      title={t.schedule}
      from={from}
      zone={zone}
      changeWeek={move}
      lessons={events}
      loading={!current}
      unavailableDays={unavailableDays}
      lessonUrl={(id) => '/teacher/lessons/' + encodeURIComponent(id) + weekSearch(week)}
      navigate={navigate}
      notice={
        !current ? (
          <div className="cab-empty" role="status">
            {t.loading}
          </div>
        ) : unavailableDays.length > 0 ? (
          <div className="cab-empty cab-empty-error" role="status">
            <span>
              {unavailableDays.length === 7 ? t.calendarUnavailable : t.calendarIncomplete}
            </span>
            <button
              className="cab-text-button"
              type="button"
              onClick={() => setAttempt(attempt + 1)}
            >
              {t.retry}
            </button>
          </div>
        ) : undefined
      }
    />
  );
}
