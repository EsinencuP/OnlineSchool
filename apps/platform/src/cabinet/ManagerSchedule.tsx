import { useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { localDateTimeToIso, useLocale } from '@online-school/ui';
import { useEndpoint } from './hooks.js';
import { LoadState } from './Operations.js';
import { addDays, monday, scheduleDate, StaffSchedule } from './StaffSchedule.js';
import type { ScheduleLesson } from './StaffSchedule.js';

type Lesson = components['schemas']['ManagerLessonDto'];

export function ManagerSchedule({
  zone,
  revision,
  selectedId,
  onSelect,
  onCreate,
}: {
  zone: string;
  revision: number;
  selectedId: string | undefined;
  onSelect: (lesson: Lesson) => void;
  onCreate: () => void;
}) {
  const { locale } = useLocale();
  const ro = locale === 'ro';
  const [week, setWeek] = useState<string | null>(null);
  const from = week ?? monday(scheduleDate(new Date(), zone));
  const to = addDays(from, 7);
  const read = useEndpoint<Lesson[]>(
    'listManagerSchedule',
    {},
    {
      from: localDateTimeToIso(from + 'T00:00', zone) ?? addDays(from, -1) + 'T00:00:00Z',
      to: localDateTimeToIso(to + 'T00:00', zone) ?? addDays(to, 1) + 'T00:00:00Z',
    },
    revision,
  );
  const items = Array.isArray(read.data) ? read.data : [];
  const error =
    read.error ??
    (!read.pending && !Array.isArray(read.data) ? new Error('INVALID_RESPONSE') : null);
  const standardTitle = ro ? 'Lecție' : 'Занятие';
  const lessons: ScheduleLesson[] = items
    .filter((lesson) => lesson.status !== 'CANCELLED')
    .map((lesson) => ({
      id: lesson.lessonId,
      startsAt: lesson.startsAt,
      endsAt: lesson.endsAt,
      title: lesson.trialBrief?.subjectName || lesson.teacherName || standardTitle,
      person: lesson.trialBrief?.subjectName ? lesson.teacherName : '',
      status: lesson.status,
      trial: lesson.kind === 'TRIAL',
    }));

  return (
    <StaffSchedule
      title={ro ? 'Orarul școlii' : 'Расписание школы'}
      zone={zone}
      from={from}
      changeWeek={setWeek}
      lessons={lessons}
      selectedId={selectedId}
      onSelect={(id) => {
        const lesson = items.find((item) => item.lessonId === id);
        if (lesson) onSelect(lesson);
      }}
      loading={read.pending}
      unavailableDays={error ? Array.from({ length: 7 }, (_, index) => addDays(from, index)) : []}
      notice={
        read.pending || error ? (
          <LoadState refreshing={read.pending} error={error} retry={read.refresh} />
        ) : undefined
      }
      action={
        <button className="cab-button cab-schedule-create" type="button" onClick={onCreate}>
          <span aria-hidden="true">+</span> {ro ? 'Programează o lecție' : 'Назначить урок'}
        </button>
      }
    />
  );
}
