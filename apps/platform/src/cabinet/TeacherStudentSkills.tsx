import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateTime, useLocale } from '@online-school/ui';
import { useCabinetCommand, useEndpoint } from './hooks.js';
import { isRouteUuid } from './studentSubjectRoutes.js';

type Schemas = components['schemas'];
type Skill = Schemas['TeacherSkillDto'];
type Assessment = Schemas['AssessSkillDto'];
type Lesson = Schemas['OverviewLessonDto'];
type Props = {
  enrollmentId: string;
  recentLessons: Lesson[];
  zone: string;
  onChanged?: () => void;
};
type Notice = 'saved' | 'stale' | 'assessmentUnavailable' | 'retryExpired';

const stages = {
  NOT_STUDIED: { ru: 'Не изучено', ro: 'Nestudiat', tone: 'violet' },
  FAMILIARIZING: { ru: 'Знакомится', ro: 'Se familiarizează', tone: 'peach' },
  PRACTICING: { ru: 'Практикует', ro: 'Exersează', tone: 'blue' },
  APPLYING: { ru: 'Применяет', ro: 'Aplică', tone: 'mint' },
} satisfies Record<Skill['status'], { ru: string; ro: string; tone: string }>;
const stageValues = Object.keys(stages) as Skill['status'][];

const copy = {
  ru: {
    title: 'Карта навыков',
    uncategorized: 'Без категории',
    personal: 'Индивидуальный навык',
    empty: 'Для этого предмета пока нет навыков.',
    history: 'История навыка',
    emptyHistory: 'Изменений пока нет.',
    loading: 'Загружаем данные…',
    unavailable: 'Не удалось загрузить данные.',
    refresh: 'Обновить данные',
    assess: 'Оценить навык',
    stage: 'Новый этап',
    chooseStage: 'Выберите этап',
    invalidStage: 'Выберите этап, отличный от текущего.',
    basis: 'Внутреннее обоснование',
    basisHint: 'От 5 до 1000 символов. Доступно сотрудникам с правом просмотра.',
    invalidBasis: 'Введите обоснование от 5 до 1000 символов.',
    comment: 'Комментарий для ученика',
    commentHint: 'Необязательно. До 500 символов.',
    invalidComment: 'Комментарий должен содержать не более 500 символов.',
    lesson: 'Подтверждённый урок (необязательно)',
    noLesson: 'Без урока',
    lessonUnavailable: 'Урок недоступен как основание. Выберите другой урок или «Без урока».',
    save: 'Сохранить оценку',
    submitting: 'Отправляем…',
    cancel: 'Отмена',
    saved: 'Оценка сохранена.',
    stale: 'Этап навыка изменился. Проверьте текущий этап перед новой оценкой.',
    assessmentUnavailable: 'Навык или запись на предмет недоступны для оценки.',
    rejected: 'Сервер отклонил оценку. Проверьте введённые данные.',
    forbidden: 'Не удалось подтвердить доступ для отправки оценки.',
    throttled: 'Слишком много запросов. Попробуйте позже.',
    unknown: 'Результат отправки пока неизвестен. Повтор использует тот же запрос.',
    retry: 'Повторить отправку',
    retryExpired: 'Срок безопасного повтора истёк. Проверьте текущий этап и историю навыка.',
  },
  ro: {
    title: 'Harta competențelor',
    uncategorized: 'Fără categorie',
    personal: 'Competență individuală',
    empty: 'Nu există încă competențe pentru această disciplină.',
    history: 'Istoricul competenței',
    emptyHistory: 'Nu există încă modificări.',
    loading: 'Se încarcă datele…',
    unavailable: 'Datele nu au putut fi încărcate.',
    refresh: 'Reîncarcă datele',
    assess: 'Evaluează competența',
    stage: 'Etapă nouă',
    chooseStage: 'Alege etapa',
    invalidStage: 'Alege o etapă diferită de cea actuală.',
    basis: 'Justificare internă',
    basisHint: 'Între 5 și 1000 de caractere. Vizibilă personalului autorizat.',
    invalidBasis: 'Introdu o justificare între 5 și 1000 de caractere.',
    comment: 'Comentariu pentru elev',
    commentHint: 'Opțional. Cel mult 500 de caractere.',
    invalidComment: 'Comentariul poate avea cel mult 500 de caractere.',
    lesson: 'Lecție confirmată (opțional)',
    noLesson: 'Fără lecție',
    lessonUnavailable:
      'Lecția nu este disponibilă ca justificare. Alege altă lecție sau „Fără lecție”.',
    save: 'Salvează evaluarea',
    submitting: 'Se trimite…',
    cancel: 'Anulează',
    saved: 'Evaluarea a fost salvată.',
    stale: 'Etapa competenței s-a schimbat. Verifică etapa actuală înainte de o nouă evaluare.',
    assessmentUnavailable:
      'Competența sau înscrierea la disciplină nu este disponibilă pentru evaluare.',
    rejected: 'Serverul a respins evaluarea. Verifică datele introduse.',
    forbidden: 'Accesul pentru trimiterea evaluării nu a putut fi confirmat.',
    throttled: 'Prea multe cereri. Încearcă mai târziu.',
    unknown: 'Rezultatul trimiterii este încă necunoscut. Reîncercarea folosește aceeași cerere.',
    retry: 'Reîncearcă trimiterea',
    retryExpired:
      'Perioada de reîncercare sigură a expirat. Verifică etapa actuală și istoricul competenței.',
  },
};

type Locale = keyof typeof copy;
type Copy = (typeof copy)[Locale];
type Time = (value: string) => string;

function Stage({ value, locale }: { value: Skill['status']; locale: Locale }) {
  return (
    <span className={'cab-status cab-tone-' + stages[value].tone}>{stages[value][locale]}</span>
  );
}

function SkillsLoad({ pending, refresh, t }: { pending: boolean; refresh: () => void; t: Copy }) {
  return pending ? (
    <div className="cab-empty" role="status">
      {t.loading}
    </div>
  ) : (
    <div className="cab-empty cab-empty-error" role="alert">
      <span>{t.unavailable}</span>
      <button type="button" className="cab-text-button" onClick={refresh}>
        {t.refresh}
      </button>
    </div>
  );
}

function SkillHistory({
  enrollmentId,
  skillId,
  locale,
  time,
}: {
  enrollmentId: string;
  skillId: string;
  locale: Locale;
  time: Time;
}) {
  const t = copy[locale];
  const result = useEndpoint<Schemas['TeacherSkillHistoryDto']>('getTeacherSkillHistory', {
    enrollmentId,
    skillId,
  });
  if (result.data?.skillId !== skillId)
    return <SkillsLoad pending={result.pending} refresh={result.refresh} t={t} />;
  if (!result.data.items.length) return <p className="cab-empty">{t.emptyHistory}</p>;

  return (
    <ol className="cab-lesson-reports">
      {result.data.items.map((entry) => (
        <li key={entry.auditId}>
          <p className="cab-skill-meta">
            <time dateTime={entry.changedAt}>{time(entry.changedAt)}</time>
            {entry.teacherName && ' · ' + entry.teacherName}
          </p>
          <p className="cab-skill-stage-change">
            <Stage value={entry.fromStatus} locale={locale} />
            <span aria-hidden="true">→</span>
            <Stage value={entry.toStatus} locale={locale} />
          </p>
          <p className="cab-long-copy">
            <strong>{t.basis}</strong>
            <br />
            {entry.basis}
          </p>
          {entry.publicComment && (
            <p className="cab-long-copy">
              <strong>{t.comment}</strong>
              <br />
              {entry.publicComment}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function SkillAssessment({
  formId,
  enrollmentId,
  skill,
  lessons,
  locale,
  time,
  cancel,
  reconcile,
}: {
  formId: string;
  enrollmentId: string;
  skill: Skill;
  lessons: Lesson[];
  locale: Locale;
  time: Time;
  cancel: () => void;
  reconcile: (notice: Notice) => void;
}) {
  const t = copy[locale];
  const basisHintId = useId();
  const commentHintId = useId();
  const [validation, setValidation] = useState<
    'invalidStage' | 'invalidBasis' | 'invalidComment' | 'lessonUnavailable' | null
  >(null);
  const command = useCabinetCommand<
    Assessment,
    Schemas['AssessSkillResponseDto'],
    'lessonUnavailable'
  >(
    'assessTeacherSkill',
    (response, body) => {
      if (
        response?.enrollmentId !== enrollmentId ||
        response.skillId !== skill.skillId ||
        response.toStatus !== body.level ||
        !stageValues.includes(response.fromStatus) ||
        response.fromStatus === response.toStatus ||
        !isRouteUuid(response.id) ||
        !Number.isFinite(Date.parse(response.assessedAt))
      )
        return false;
      reconcile('saved');
      return true;
    },
    (code) => {
      if (code === 'SKILL_LESSON_NOT_CONFIRMED') return 'lessonUnavailable';
      if (code === 'SKILL_LEVEL_UNCHANGED' || code === 'SKILL_CHANGED_CONCURRENTLY')
        reconcile('stale');
      if (code === 'NOT_FOUND') reconcile('assessmentUnavailable');
      return undefined;
    },
    { enrollmentId, skillId: skill.skillId },
  );
  const locked = command.busy || command.unresolved;

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    const values = new FormData(event.currentTarget);
    const level = stageValues.find((value) => value === values.get('level'));
    const basis = String(values.get('basis') ?? '').trim();
    const publicComment = String(values.get('publicComment') ?? '').trim();
    const lessonId = String(values.get('lessonId') ?? '');
    const basisLength = [...basis].length;
    if (!level || level === skill.status) return setValidation('invalidStage');
    if (basisLength < 5 || basisLength > 1000) return setValidation('invalidBasis');
    if ([...publicComment].length > 500) return setValidation('invalidComment');
    if (lessonId && !lessons.some((lesson) => lesson.lessonId === lessonId))
      return setValidation('lessonUnavailable');
    setValidation(null);
    command.submit({
      level,
      basis,
      ...(publicComment ? { publicComment } : {}),
      ...(lessonId ? { lessonId } : {}),
    });
  }

  return (
    <form
      id={formId}
      aria-label={t.assess}
      noValidate
      onSubmit={send}
      onChange={() => setValidation(null)}
    >
      <fieldset className="cab-fields cab-lesson-fields" disabled={locked}>
        <label className="cab-form-label">
          <span>{t.stage}</span>
          <select
            name="level"
            autoFocus
            required
            defaultValue=""
            aria-invalid={validation === 'invalidStage'}
          >
            <option value="" disabled>
              {t.chooseStage}
            </option>
            {stageValues.map((value) => (
              <option key={value} value={value} disabled={value === skill.status}>
                {stages[value][locale]}
              </option>
            ))}
          </select>
        </label>
        <label className="cab-form-label">
          <span>{t.lesson}</span>
          <select
            name="lessonId"
            aria-invalid={
              validation === 'lessonUnavailable' || command.error === 'lessonUnavailable'
            }
          >
            <option value="">{t.noLesson}</option>
            {lessons.map((lesson) => (
              <option key={lesson.lessonId} value={lesson.lessonId}>
                {time(lesson.startsAt)}
              </option>
            ))}
          </select>
        </label>
        <div className="cab-form-label cab-lesson-note">
          <label htmlFor={basisHintId + '-field'}>{t.basis}</label>
          <textarea
            id={basisHintId + '-field'}
            name="basis"
            rows={3}
            required
            aria-describedby={basisHintId}
            aria-invalid={validation === 'invalidBasis'}
          />
          <small id={basisHintId}>{t.basisHint}</small>
        </div>
        <div className="cab-form-label cab-lesson-note">
          <label htmlFor={commentHintId + '-field'}>{t.comment}</label>
          <textarea
            id={commentHintId + '-field'}
            name="publicComment"
            rows={2}
            aria-describedby={commentHintId}
            aria-invalid={validation === 'invalidComment'}
          />
          <small id={commentHintId}>{t.commentHint}</small>
        </div>
        {validation && (
          <p className="cab-form-error" role="alert">
            {t[validation]}
          </p>
        )}
        <div className="cab-form-actions">
          <button type="button" className="cab-button cab-secondary" onClick={cancel}>
            {t.cancel}
          </button>
          <button type="submit" className="cab-button cab-primary">
            {command.busy ? t.submitting : t.save}
          </button>
        </div>
      </fieldset>
      {command.error && (
        <p className="cab-form-error" role="alert">
          {t[command.error]}
        </p>
      )}
      {command.error === 'retryExpired' ? (
        <div className="cab-form-actions">
          <button
            type="button"
            className="cab-button cab-secondary"
            onClick={() => reconcile('retryExpired')}
          >
            {t.refresh}
          </button>
        </div>
      ) : (
        command.unresolved && (
          <div className="cab-empty">
            <span role="status">{t.unknown}</span>
            <button
              type="button"
              className="cab-button cab-secondary"
              disabled={command.busy}
              onClick={command.retry}
            >
              {command.busy ? t.submitting : t.retry}
            </button>
          </div>
        )
      )}
    </form>
  );
}

function SkillMap({ enrollmentId, recentLessons, zone, onChanged }: Props) {
  const { locale } = useLocale();
  const t = copy[locale];
  const time: Time = (value) => formatDateTime(value, locale, zone) ?? '—';
  const result = useEndpoint<Schemas['TeacherSkillMapDto']>('getTeacherSkillMap', { enrollmentId });
  const formId = useId();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const map = result.data?.enrollmentId === enrollmentId ? result.data : null;
  const lessons = recentLessons.filter(
    (lesson) => lesson.status === 'CONDUCTED' && isRouteUuid(lesson.lessonId),
  );
  const categories = new Map<string, Skill[]>();
  for (const skill of map?.skills ?? []) {
    const skills = categories.get(skill.category);
    if (skills) skills.push(skill);
    else categories.set(skill.category, [skill]);
  }

  function reconcile(outcome: Notice) {
    setSelection(null);
    setNotice(outcome);
    result.refresh();
    if (outcome === 'saved') onChanged?.();
  }

  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <h2>{t.title}</h2>
      {notice && (
        <p
          className={notice === 'saved' ? 'cab-empty' : 'cab-form-error'}
          role={notice === 'saved' ? 'status' : 'alert'}
        >
          {t[notice]}
        </p>
      )}
      {!map ? (
        <SkillsLoad pending={result.pending} refresh={result.refresh} t={t} />
      ) : !categories.size ? (
        <p className="cab-empty">{t.empty}</p>
      ) : (
        [...categories].map(([category, skills]) => (
          <section key={category} className="cab-lesson-stack">
            <h3>{category || t.uncategorized}</h3>
            <ul className="cab-lesson-resources cab-skill-list">
              {skills.map((skill) => (
                <li key={skill.skillId} className="cab-lesson-stack">
                  <div className="cab-skill-heading">
                    <h4>{skill.name}</h4>
                    <Stage value={skill.status} locale={locale} />
                  </div>
                  {skill.personal && <p className="cab-skill-meta">{t.personal}</p>}
                  {skill.assessedAt && (
                    <p className="cab-skill-meta">
                      <time dateTime={skill.assessedAt}>{time(skill.assessedAt)}</time>
                      {skill.assessedByName && ' · ' + skill.assessedByName}
                    </p>
                  )}
                  {skill.publicComment && (
                    <p className="cab-long-copy">
                      <strong>{t.comment}</strong>
                      <br />
                      {skill.publicComment}
                    </p>
                  )}
                  <details
                    className="cab-disclosure"
                    open={expanded.has(skill.skillId)}
                    onToggle={(event) => {
                      const open = event.currentTarget.open;
                      setExpanded((current) => {
                        if (open === current.has(skill.skillId)) return current;
                        const next = new Set(current);
                        if (open) next.add(skill.skillId);
                        else next.delete(skill.skillId);
                        return next;
                      });
                    }}
                  >
                    <summary>{t.history}</summary>
                    {expanded.has(skill.skillId) && (
                      <SkillHistory
                        enrollmentId={enrollmentId}
                        skillId={skill.skillId}
                        locale={locale}
                        time={time}
                      />
                    )}
                  </details>
                  <div className="cab-form-actions">
                    <button
                      type="button"
                      className="cab-button cab-secondary"
                      aria-expanded={selection === skill.skillId}
                      aria-controls={selection === skill.skillId ? formId : undefined}
                      aria-disabled={selection === skill.skillId}
                      disabled={selection !== null && selection !== skill.skillId}
                      onClick={(event) => {
                        if (selection !== null) return;
                        trigger.current = event.currentTarget;
                        setNotice(null);
                        setSelection(skill.skillId);
                      }}
                    >
                      {t.assess}
                    </button>
                  </div>
                  {selection === skill.skillId && (
                    <SkillAssessment
                      key={skill.skillId}
                      formId={formId}
                      enrollmentId={enrollmentId}
                      skill={skill}
                      lessons={lessons}
                      locale={locale}
                      time={time}
                      cancel={() => {
                        setSelection(null);
                        trigger.current?.focus();
                      }}
                      reconcile={reconcile}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

export function TeacherStudentSkills(props: Props) {
  return <SkillMap key={props.enrollmentId} {...props} />;
}
