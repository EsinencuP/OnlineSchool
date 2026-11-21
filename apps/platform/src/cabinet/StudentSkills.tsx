import { useId, useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateOnly, formatDateTime, Icon, useLocale } from '@online-school/ui';
import { SubjectIcon } from './Brand.js';
import { CabinLink } from './Home.js';
import { LoadState } from './Operations.js';
import { StudyPager } from './StudentLesson.js';
import { SubjectBack } from './StudentSubjects.js';
import { useEndpoint } from './hooks.js';
import { subjectSkills } from './studentSubjectRoutes.js';

type Schemas = components['schemas'];
type Stage = Schemas['SkillDto']['status'];
type SkillMap = Schemas['SubjectSkillMapDto'];

const stages: Record<Stage, { label: [string, string]; tone: string }> = {
  NOT_STUDIED: { label: ['Не изучено', 'Nestudiat'], tone: 'violet' },
  FAMILIARIZING: { label: ['Знакомлюсь', 'Mă familiarizez'], tone: 'peach' },
  PRACTICING: { label: ['Практикую', 'Exersez'], tone: 'blue' },
  APPLYING: { label: ['Применяю', 'Aplic'], tone: 'mint' },
};
const copy = {
  title: ['Карта навыков', 'Harta competențelor'],
  allMaps: ['Все карты навыков', 'Toate hărțile de competențe'],
  openMap: ['Открыть карту предмета', 'Deschide harta disciplinei'],
  stage: ['Этап', 'Etapă'],
  allStages: ['Все этапы', 'Toate etapele'],
  history: ['История навыка', 'Istoricul competenței'],
  emptyHistory: ['Изменений пока нет.', 'Nu există încă modificări.'],
  noAssessment: [
    'Преподаватель пока не оценивал этот навык.',
    'Profesorul nu a evaluat încă această competență.',
  ],
  noMaps: ['Карт навыков пока нет.', 'Nu există încă hărți de competențe.'],
  noSkills: ['На этом этапе пока нет навыков.', 'Nu există încă competențe la această etapă.'],
  noSkillsHint: [
    'Навыки появятся здесь, когда преподаватель оценит их по итогам уроков. Загляните на другие этапы.',
    'Competențele apar aici după ce profesorul le evaluează în urma lecțiilor. Verifică și alte etape.',
  ],
  goals: ['Цели обучения', 'Obiective de învățare'],
  achieved: ['Достигнута', 'Atins'],
  inProgress: ['В работе', 'În lucru'],
  noGoals: ['Целей пока нет.', 'Nu există încă obiective.'],
  snapshots: ['Подтверждённые срезы', 'Evaluări confirmate'],
  afterLesson: ['После урока', 'După lecția'],
  nextSnapshot: ['Уроков до следующего среза', 'Lecții până la următoarea evaluare'],
  latest: ['Последний срез', 'Ultima evaluare'],
  noSnapshots: ['Подтверждённых срезов пока нет.', 'Nu există încă evaluări confirmate.'],
  reports: ['Все отчёты', 'Toate rapoartele'],
} as const;

function useSkills(zone: string) {
  const { locale } = useLocale();
  const language = locale === 'ro' ? 1 : 0;
  return {
    text: (key: keyof typeof copy) => copy[key][language],
    date: (value: string) => formatDateTime(value, locale, zone) ?? '—',
    day: (value: string) =>
      formatDateOnly(value, locale, { day: 'numeric', month: 'long', year: 'numeric' }) ?? '—',
    language,
  };
}

function SkillStage({ stage }: { stage: Stage }) {
  const { locale } = useLocale();
  const { label, tone } = stages[stage];
  return <span className={'cab-status cab-tone-' + tone}>{label[locale === 'ro' ? 1 : 0]}</span>;
}

function SkillAudit({ skillId, zone }: { skillId: string; zone: string }) {
  const { text, date } = useSkills(zone);
  const [page, setPage] = useState(1);
  const audit = useEndpoint<Schemas['SkillAuditResponseDto']>(
    'getStudentSkillAudit',
    {},
    { skillId, page },
  );
  if (audit.pending || audit.error)
    return <LoadState refreshing={audit.pending} error={audit.error} retry={audit.refresh} />;
  if (!audit.data) return null;
  return (
    <>
      {audit.data.items.length ? (
        <ol className="cab-lesson-reports">
          {audit.data.items.map((entry) => (
            <li key={entry.auditId}>
              <p className="cab-skill-meta">
                <time dateTime={entry.changedAt}>{date(entry.changedAt)}</time>
                {entry.teacherName && ' · ' + entry.teacherName}
              </p>
              <p className="cab-skill-stage-change">
                <SkillStage stage={entry.fromStatus} />
                <span aria-hidden="true">→</span>
                <SkillStage stage={entry.toStatus} />
              </p>
              {entry.comment && <p className="cab-long-copy">{entry.comment}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="cab-empty">{text('emptyHistory')}</p>
      )}
      <StudyPager {...audit.data} change={setPage} />
    </>
  );
}

function SkillRow({ skill, zone }: { skill: Schemas['SkillDto']; zone: string }) {
  const { date, text } = useSkills(zone);
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="cab-skill-heading">
        <div>
          <h3>{skill.name}</h3>
          {skill.category && <p className="cab-skill-meta">{skill.category}</p>}
        </div>
        <SkillStage stage={skill.status} />
      </div>
      <p className="cab-skill-meta">
        {skill.lastUpdatedByTeacherName ? (
          <>
            <time dateTime={skill.lastUpdatedAt}>{date(skill.lastUpdatedAt)}</time>
            {' · ' + skill.lastUpdatedByTeacherName}
          </>
        ) : (
          text('noAssessment')
        )}
      </p>
      <details className="cab-disclosure" onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>{text('history')}</summary>
        {open && <SkillAudit skillId={skill.skillId} zone={zone} />}
      </details>
    </li>
  );
}

function SkillBoard({
  map,
  stage,
  zone,
  navigate,
  scoped,
}: {
  map: SkillMap;
  stage: Stage | '';
  zone: string;
  navigate: (url: string) => void;
  scoped: boolean;
}) {
  const { date, day, text } = useSkills(zone);
  const skills = map.skills.filter((skill) => !stage || skill.status === stage);
  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <div className="cab-subject-intro">
        <SubjectIcon subject={map.subjectName} />
        <div>
          <h2>{map.subjectName}</h2>
          {map.lastSnapshotAt && (
            <p className="cab-skill-meta">
              {text('latest')} ·{' '}
              <time dateTime={map.lastSnapshotAt}>{date(map.lastSnapshotAt)}</time>
            </p>
          )}
          {map.nextSnapshotIn !== null && (
            <p className="cab-skill-meta">
              {text('nextSnapshot')} · {map.nextSnapshotIn}
            </p>
          )}
        </div>
      </div>
      {!scoped && (
        <CabinLink
          to={subjectSkills + '?' + new URLSearchParams({ subjectId: map.subjectId })}
          navigate={navigate}
          className="cab-inline-link"
        >
          {text('openMap')} <Icon name="arrow" size={16} />
        </CabinLink>
      )}
      {skills.length ? (
        <ul className="cab-lesson-resources cab-skill-list">
          {skills.map((skill) => (
            <SkillRow key={skill.skillId} skill={skill} zone={zone} />
          ))}
        </ul>
      ) : (
        <p className="cab-empty cab-empty-stack">
          <span>{text('noSkills')}</span>
          <small>{text('noSkillsHint')}</small>
        </p>
      )}
      <details className="cab-disclosure">
        <summary>{text('goals')}</summary>
        {map.learningGoals.length ? (
          <ul className="cab-lesson-resources">
            {map.learningGoals.map((goal) => (
              <li key={goal.goalId}>
                <p className="cab-long-copy">{goal.text}</p>
                <span className={'cab-status cab-tone-' + (goal.isAchieved ? 'mint' : 'violet')}>
                  {text(goal.isAchieved ? 'achieved' : 'inProgress')}
                </span>
                {goal.targetDate && <time dateTime={goal.targetDate}>{day(goal.targetDate)}</time>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cab-empty">{text('noGoals')}</p>
        )}
      </details>
    </section>
  );
}

function SkillSnapshots({
  subjectId,
  zone,
  navigate,
}: {
  subjectId: string | null;
  zone: string;
  navigate: (url: string) => void;
}) {
  const { text, date } = useSkills(zone);
  const [page, setPage] = useState(1);
  const snapshots = useEndpoint<Schemas['SkillSnapshotResponseDto']>(
    'getStudentSkillSnapshots',
    {},
    { page, ...(subjectId ? { subjectId } : {}) },
  );
  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <h2>{text('snapshots')}</h2>
      {snapshots.pending || snapshots.error ? (
        <LoadState
          refreshing={snapshots.pending}
          error={snapshots.error}
          retry={snapshots.refresh}
        />
      ) : snapshots.data?.items.length ? (
        <>
          {snapshots.data.items.map((snapshot) => (
            <details className="cab-disclosure cab-skill-snapshot" key={snapshot.snapshotId}>
              <summary>
                <strong>{snapshot.subjectName}</strong>
                <span>
                  {text('afterLesson')} {snapshot.lessonNumber} · {date(snapshot.createdAt)}
                </span>
              </summary>
              {snapshot.teacherSummary && (
                <p className="cab-long-copy">{snapshot.teacherSummary}</p>
              )}
              <ul className="cab-lesson-resources">
                {snapshot.skills.map((skill, index) => (
                  <li key={index}>
                    <strong>{skill.skillName}</strong>
                    <SkillStage stage={skill.status} />
                    {skill.teacherComment && (
                      <p className="cab-long-copy">{skill.teacherComment}</p>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </>
      ) : (
        <p className="cab-empty">{text('noSnapshots')}</p>
      )}
      {snapshots.data && <StudyPager {...snapshots.data} change={setPage} />}
      <CabinLink to="/student/reports" navigate={navigate} className="cab-inline-link">
        {text('reports')} <Icon name="arrow" size={16} />
      </CabinLink>
    </section>
  );
}

export function StudentSkills({
  subjectId,
  zone,
  navigate,
}: {
  subjectId: string | null;
  zone: string;
  navigate: (url: string) => void;
}) {
  const { text, language } = useSkills(zone);
  const stageId = useId();
  const [stage, setStage] = useState<Stage | ''>('');
  const maps = useEndpoint<SkillMap[]>('getStudentSkillMaps', {}, subjectId ? { subjectId } : {});
  return (
    <div className="cab-lesson-stack">
      <div className="cab-subject-toolbar">
        <SubjectBack {...(subjectId ? { id: subjectId } : {})} navigate={navigate} />
        {subjectId && (
          <CabinLink to={subjectSkills} navigate={navigate} className="cab-inline-link">
            {text('allMaps')}
          </CabinLink>
        )}
      </div>
      <div className="cab-lesson-grid">
        <div className="cab-lesson-stack">
          <div className="cab-form-label cab-skill-filter">
            <label htmlFor={stageId}>{text('stage')}</label>
            <select
              id={stageId}
              value={stage}
              onChange={(event) => setStage(event.target.value as Stage | '')}
            >
              <option value="">{text('allStages')}</option>
              {(Object.keys(stages) as Stage[]).map((value) => (
                <option key={value} value={value}>
                  {stages[value].label[language]}
                </option>
              ))}
            </select>
          </div>
          {maps.pending || maps.error ? (
            <LoadState refreshing={maps.pending} error={maps.error} retry={maps.refresh} />
          ) : maps.data?.length ? (
            maps.data.map((map) => (
              <SkillBoard
                key={map.subjectId}
                map={map}
                stage={stage}
                zone={zone}
                navigate={navigate}
                scoped={Boolean(subjectId)}
              />
            ))
          ) : (
            <p className="cab-empty">{text('noMaps')}</p>
          )}
        </div>
        <SkillSnapshots subjectId={subjectId} zone={zone} navigate={navigate} />
      </div>
    </div>
  );
}
