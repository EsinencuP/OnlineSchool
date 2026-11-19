import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { operations } from '@online-school/api-contracts';
import { formatDateOnly, useLocale } from '@online-school/ui';
import { CabinetError } from './contract.js';
import { useCabinetCommand, useEndpoint } from './hooks.js';
import { isRouteUuid } from './studentSubjectRoutes.js';
import { teacherGoalsCopy } from './teacherGoalsCopy.js';
import type { GoalsCopy } from './teacherGoalsCopy.js';

type GoalList = operations['getTeacherGoals']['responses'][200]['content']['application/json'];
type SkillMap = operations['getTeacherSkillMap']['responses'][200]['content']['application/json'];
type CreateGoal = operations['createTeacherGoal']['requestBody']['content']['application/json'];
type UpdateGoal = operations['updateTeacherGoal']['requestBody']['content']['application/json'];
type GoalResult = operations['createTeacherGoal']['responses'][200]['content']['application/json'];
type UpdateResult =
  operations['updateTeacherGoal']['responses'][200]['content']['application/json'];
type Goal = GoalList['goals'][number];
type GoalStatus = Goal['status'];
type Skills = SkillMap['skills'];
type StaleGoal = 'archived' | 'missingGoal';

const tones: Record<GoalStatus, string> = {
  ACTIVE: 'blue',
  ACHIEVED: 'mint',
  PAUSED: 'peach',
  ARCHIVED: 'violet',
};

const statuses = Object.keys(tones) as GoalStatus[];

function GoalEditor({
  enrollmentId,
  goal,
  skills,
  skillsPending,
  refreshSkills,
  refreshGoals,
  goalsReady,
  accessDenied,
  stale,
  t,
  onClose,
  onSaved,
  onStale,
}: {
  enrollmentId: string;
  goal: Goal | null;
  skills: Skills | null;
  skillsPending: boolean;
  refreshSkills: () => void;
  refreshGoals: () => void;
  goalsReady: boolean;
  accessDenied: boolean;
  stale: StaleGoal | null;
  t: GoalsCopy;
  onClose: () => void;
  onSaved: () => void;
  onStale: (reason: StaleGoal) => void;
}) {
  const headingId = useId();
  const [text, setText] = useState(goal?.text ?? '');
  const [date, setDate] = useState(goal?.targetDate ?? '');
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'ACTIVE');
  const [skillId, setSkillId] = useState('');
  const [invalidText, setInvalidText] = useState(false);
  const textErrorId = `${headingId}-text-error`;
  const trimmedText = text.trim();
  const targetDate = date || null;
  const selectedSkillMissing = Boolean(
    skillId && !skills?.some((skill) => skill.skillId === skillId),
  );

  function onRejected(code: string) {
    switch (code) {
      case 'ENROLLMENT_INACTIVE':
        return 'inactive';
      case 'GOAL_DATE_IN_PAST':
        return 'pastDate';
      case 'GOAL_ARCHIVED':
        onStale('archived');
        return 'archived';
      case 'NOT_FOUND':
        if (goal) {
          onStale('missingGoal');
          return 'missingGoal';
        }
        refreshGoals();
        refreshSkills();
        return 'missingSkillOrEnrollment';
      case 'INVALID_INPUT':
        return 'invalidInput';
      case 'INVALID_RESPONSE':
        refreshGoals();
        return 'invalidResponse';
    }
  }

  type Rejection = NonNullable<ReturnType<typeof onRejected>>;
  const create = useCabinetCommand<CreateGoal, GoalResult, Rejection>(
    'createTeacherGoal',
    (result) => {
      if (!isRouteUuid(result?.id) || result.status !== 'ACTIVE') return false;
      onSaved();
      return true;
    },
    onRejected,
    { enrollmentId },
  );
  const update = useCabinetCommand<UpdateGoal, UpdateResult, Rejection>(
    'updateTeacherGoal',
    (result, body) => {
      if (!result || result.id !== goal?.goalId || !statuses.includes(result.status)) return false;
      if (body.status !== undefined && result.status !== body.status) return false;
      onSaved();
      return true;
    },
    onRejected,
    goal ? { enrollmentId, goalId: goal.goalId } : undefined,
  );
  const command = goal ? update : create;
  const locked = command.busy || command.unresolved;
  const fieldsLocked = locked || command.error === 'invalidResponse';
  const changes: UpdateGoal = goal
    ? {
        ...(trimmedText !== goal.text.trim() ? { text: trimmedText } : {}),
        ...(targetDate !== (goal.targetDate ?? null) ? { targetDate } : {}),
        ...(status !== goal.status ? { status } : {}),
      }
    : {};
  const cannotSave =
    fieldsLocked ||
    !goalsReady ||
    stale !== null ||
    selectedSkillMissing ||
    Boolean(goal && Object.keys(changes).length === 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cannotSave) return;
    if (!goal || changes.text !== undefined) {
      // Match the DTO length check for surrogate pairs and presentation selectors.
      const length = Array.from(
        trimmedText.replace(/([^\uFE0F\uFE0E])[\uFE0F\uFE0E]/gu, '$1'),
      ).length;
      if (length < 5 || length > 500) {
        setInvalidText(true);
        return;
      }
    }
    if (goal) {
      update.submit(changes);
    } else {
      create.submit({
        text: trimmedText,
        ...(targetDate ? { targetDate } : {}),
        ...(skillId ? { skillId } : {}),
      });
    }
  }

  return (
    <form
      className="cab-card cab-panel cab-lesson-stack"
      aria-labelledby={headingId}
      onSubmit={submit}
    >
      <h2 id={headingId}>{goal ? t.editGoal : t.newGoal}</h2>
      {command.error && (
        <p className="cab-form-error" role="alert">
          {t[command.error]}
        </p>
      )}
      {stale && (
        <p className="cab-form-error" role="alert">
          {t[stale]}
        </p>
      )}
      {command.unresolved && command.error !== 'retryExpired' && (
        <div className="cab-empty">
          <p role="status">{t.unknown}</p>
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={command.busy}
            onClick={command.retry}
          >
            {command.busy ? t.saving : t.retry}
          </button>
        </div>
      )}
      {!accessDenied && !stale && (
        <fieldset className="cab-lesson-fields" disabled={fieldsLocked}>
          <div className="cab-lesson-stack">
            <label className="cab-form-label">
              <span>{t.text}</span>
              <textarea
                name="text"
                rows={4}
                aria-required={!goal}
                aria-invalid={invalidText || undefined}
                aria-describedby={invalidText ? textErrorId : undefined}
                autoFocus
                value={text}
                onChange={(event) => {
                  setText(event.currentTarget.value);
                  setInvalidText(false);
                }}
              />
            </label>
            {invalidText && (
              <p id={textErrorId} className="cab-form-error" role="alert">
                {t.invalidText}
              </p>
            )}
            <label className="cab-form-label">
              <span>{t.targetDate}</span>
              <input
                type="date"
                name="targetDate"
                value={date}
                onChange={(event) => setDate(event.currentTarget.value)}
              />
            </label>
            {date && (
              <div>
                <button type="button" className="cab-text-button" onClick={() => setDate('')}>
                  {t.clearDate}
                </button>
              </div>
            )}
            {goal ? (
              <label className="cab-form-label">
                <span>{t.status}</span>
                <select
                  name="status"
                  value={status}
                  onChange={(event) => setStatus(event.currentTarget.value as GoalStatus)}
                >
                  {statuses.map((value) => (
                    <option value={value} key={value}>
                      {t.statuses[value]}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="cab-form-label">
                  <span>{t.skill}</span>
                  <select
                    name="skillId"
                    value={skillId}
                    onChange={(event) => setSkillId(event.currentTarget.value)}
                  >
                    <option value="">{t.noSkill}</option>
                    {selectedSkillMissing && (
                      <option value={skillId} disabled>
                        {t.skillUnavailable}
                      </option>
                    )}
                    {skills?.map((skill) => (
                      <option value={skill.skillId} key={skill.skillId}>
                        {skill.name}
                      </option>
                    ))}
                  </select>
                </label>
                {skillsPending && <p role="status">{t.skillsLoading}</p>}
                {!skillsPending && !skills && (
                  <div className="cab-empty">
                    <p role="status">{t.skillsFailed}</p>
                    <button type="button" className="cab-text-button" onClick={refreshSkills}>
                      {t.refreshSkills}
                    </button>
                  </div>
                )}
                {selectedSkillMissing && !skillsPending && (
                  <p className="cab-form-error" role="alert">
                    {t.chooseSkill}
                  </p>
                )}
              </>
            )}
          </div>
        </fieldset>
      )}
      <div className="cab-form-actions">
        <button
          type="button"
          className="cab-button cab-secondary"
          disabled={locked}
          onClick={onClose}
        >
          {t.cancel}
        </button>
        {!accessDenied && !stale && (
          <button type="submit" className="cab-button cab-primary" disabled={cannotSave}>
            {command.busy && !command.unresolved ? t.saving : goal ? t.save : t.create}
          </button>
        )}
      </div>
    </form>
  );
}

function GoalsForEnrollment({ enrollmentId }: { enrollmentId: string }) {
  const { locale } = useLocale();
  const t = teacherGoalsCopy[locale];
  const headingId = useId();
  const [editor, setEditor] = useState<Goal | 'create' | null>(null);
  const [notice, setNotice] = useState<'created' | 'saved' | StaleGoal | null>(null);
  const params = { enrollmentId };
  const goals = useEndpoint<GoalList>('getTeacherGoals', params);
  const skillMap = useEndpoint<SkillMap>('getTeacherSkillMap', params);
  const items = goals.data?.enrollmentId === enrollmentId ? goals.data.goals : null;
  const skills = skillMap.data?.enrollmentId === enrollmentId ? skillMap.data.skills : null;
  const names = new Map(skills?.map((skill) => [skill.skillId, skill.name]));
  const accessDenied =
    goals.error instanceof CabinetError && [401, 403, 404].includes(goals.error.issue.status);
  const editedGoal = editor === 'create' ? null : editor;
  const latest = editedGoal && items?.find((goal) => goal.goalId === editedGoal.goalId);
  const stale =
    editedGoal && items
      ? !latest
        ? 'missingGoal'
        : latest.status === 'ARCHIVED'
          ? 'archived'
          : null
      : null;

  function open(next: Goal | 'create') {
    setNotice(null);
    setEditor(next);
  }

  function finish(message: NonNullable<typeof notice>) {
    setNotice(message);
    setEditor(null);
    goals.refresh();
  }

  return (
    <section className="cab-lesson-stack" aria-labelledby={headingId}>
      <div className="cab-panel-title">
        <h2 id={headingId}>{t.heading}</h2>
        <div className="cab-form-actions">
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={goals.pending}
            onClick={goals.refresh}
          >
            {t.refresh}
          </button>
          {!editor && items && (
            <button type="button" className="cab-button cab-primary" onClick={() => open('create')}>
              {t.newGoal}
            </button>
          )}
        </div>
      </div>
      {notice &&
        (notice === 'created' || notice === 'saved' ? (
          <p role="status">{t[notice]}</p>
        ) : (
          <p className="cab-form-error" role="alert">
            {t[notice]}
          </p>
        ))}
      <div className={editor ? 'cab-lesson-grid' : 'cab-lesson-stack'}>
        {editor && (
          <GoalEditor
            key={editedGoal?.goalId ?? 'create'}
            enrollmentId={enrollmentId}
            goal={editedGoal}
            skills={skills}
            skillsPending={skillMap.pending}
            refreshSkills={skillMap.refresh}
            refreshGoals={goals.refresh}
            goalsReady={items !== null}
            accessDenied={accessDenied}
            stale={stale}
            t={t}
            onClose={() => setEditor(null)}
            onSaved={() => finish(editedGoal ? 'saved' : 'created')}
            onStale={finish}
          />
        )}
        {goals.pending ? (
          <p className="cab-empty" role="status">
            {t.loading}
          </p>
        ) : !items ? (
          <p className="cab-empty cab-empty-error" role="alert">
            {accessDenied ? t.inaccessible : t.loadFailed}
          </p>
        ) : items.length === 0 ? (
          <p className="cab-empty">{t.empty}</p>
        ) : (
          <div className="cab-card cab-panel cab-lesson-stack">
            <ul className="cab-lesson-reports">
              {items.map((goal) => (
                <li key={goal.goalId}>
                  <p>{goal.text}</p>
                  <span className={'cab-status cab-tone-' + tones[goal.status]}>
                    {t.statuses[goal.status]}
                  </span>
                  {goal.targetDate ? (
                    <p>
                      {t.targetDate}
                      {' · '}
                      <time dateTime={goal.targetDate}>
                        {formatDateOnly(goal.targetDate, locale, {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }) ?? goal.targetDate}
                      </time>
                    </p>
                  ) : (
                    <p>{t.noDate}</p>
                  )}
                  {goal.skillId && <p>{names.get(goal.skillId) ?? t.skillUnavailable}</p>}
                  {!editor && goal.status !== 'ARCHIVED' && (
                    <div>
                      <button type="button" className="cab-text-button" onClick={() => open(goal)}>
                        {t.edit}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!skills &&
              !skillMap.pending &&
              editor !== 'create' &&
              items.some((goal) => goal.skillId) && (
                <div>
                  <button type="button" className="cab-text-button" onClick={skillMap.refresh}>
                    {t.refreshSkills}
                  </button>
                </div>
              )}
          </div>
        )}
      </div>
    </section>
  );
}

export function TeacherStudentGoals({ enrollmentId }: { enrollmentId: string; zone?: string }) {
  return <GoalsForEnrollment key={enrollmentId} enrollmentId={enrollmentId} />;
}
