import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateTime, localDateTimeToIso, useLocale } from '@online-school/ui';
import { useCabinetCommand, useEndpoint } from './hooks.js';
import { isRouteUuid } from './studentSubjectRoutes.js';
import { teacherCopy } from './teacherCopy.js';

type Schemas = components['schemas'];
type ShareMaterialDto = Schemas['ShareMaterialDto'];
type ShareMaterialResponseDto = Schemas['ShareMaterialResponseDto'];

const copy = {
  ru: {
    heading: 'Доступ к материалу',
    recipient: 'Ученик и предмет',
    chooseRecipient: 'Выберите ученика и предмет',
    loadingRecipients: 'Загружаем список учеников…',
    recipientsUnavailable: 'Не удалось загрузить список учеников.',
    retryRecipients: 'Обновить список учеников',
    noRecipients: 'Нет активных учеников по вашим предметам.',
    lesson: 'Урок (необязательно)',
    noLesson: 'Без привязки к уроку',
    lessonScope:
      'Из карточки ученика по этому предмету доступны до пяти недавних и пяти ближайших уроков.',
    loadingLessons: 'Загружаем уроки…',
    lessonsUnavailable: 'Не удалось загрузить уроки.',
    retryLessons: 'Обновить список уроков',
    noLessons: 'В карточке ученика пока нет уроков по этому предмету.',
    upcoming: 'Ближайшие уроки',
    recent: 'Недавние уроки',
    lessonTitle: 'Название урока (необязательно)',
    canDownload: 'Разрешить скачивание',
    expiry: 'Доступ до (необязательно)',
    expiryHint: 'Часовой пояс',
    submit: 'Выдать доступ',
    cancel: 'Отмена',
    submitting: 'Выдаём доступ…',
    unknown: 'Результат выдачи пока неизвестен. Повтор отправит тот же запрос.',
    retry: 'Повторить выдачу доступа',
    retryExpired: 'Срок безопасного повтора истёк. Проверьте список материалов ученика.',
    rejected: 'Не удалось выдать доступ. Проверьте данные и попробуйте снова.',
    forbidden: 'Недостаточно прав для выдачи доступа.',
    throttled: 'Слишком много запросов. Попробуйте позже.',
    duplicate:
      'У ученика уже есть запись о выдаче этого файла. Проверьте список выданных материалов ученика.',
    notVerified: 'Доступ можно выдать только к проверенному файлу.',
    noStudentAccount: 'У ученика нет активной учётной записи.',
    inactiveEnrollment: 'Запись ученика на этот предмет больше не активна.',
    invalidLesson: 'Выберите урок из карточки ученика по выбранному предмету.',
    invalidExpiry: 'Укажите корректную дату и время в будущем.',
    invalidTitle: 'Название урока должно содержать не более 200 символов.',
  },
  ro: {
    heading: 'Acces la material',
    recipient: 'Elev și disciplină',
    chooseRecipient: 'Alege elevul și disciplina',
    loadingRecipients: 'Se încarcă lista elevilor…',
    recipientsUnavailable: 'Lista elevilor nu a putut fi încărcată.',
    retryRecipients: 'Reîncarcă lista elevilor',
    noRecipients: 'Nu există elevi activi la disciplinele tale.',
    lesson: 'Lecție (opțional)',
    noLesson: 'Fără asociere cu o lecție',
    lessonScope:
      'Din fișa elevului poți alege până la cinci lecții recente și cinci viitoare la această disciplină.',
    loadingLessons: 'Se încarcă lecțiile…',
    lessonsUnavailable: 'Lecțiile nu au putut fi încărcate.',
    retryLessons: 'Reîncarcă lista lecțiilor',
    noLessons: 'În fișa elevului nu sunt încă lecții la această disciplină.',
    upcoming: 'Lecții viitoare',
    recent: 'Lecții recente',
    lessonTitle: 'Titlul lecției (opțional)',
    canDownload: 'Permite descărcarea',
    expiry: 'Acces până la (opțional)',
    expiryHint: 'Fus orar',
    submit: 'Acordă acces',
    cancel: 'Anulează',
    submitting: 'Se acordă accesul…',
    unknown: 'Rezultatul este încă necunoscut. La reîncercare se trimite aceeași cerere.',
    retry: 'Încearcă din nou acordarea accesului',
    retryExpired: 'Termenul pentru reîncercare a expirat. Verifică lista de materiale a elevului.',
    rejected: 'Accesul nu a putut fi acordat. Verifică datele și încearcă din nou.',
    forbidden: 'Nu ai permisiunea de a acorda acces.',
    throttled: 'Prea multe cereri. Încearcă mai târziu.',
    duplicate:
      'Există deja o acordare a accesului la acest fișier. Verifică lista materialelor partajate cu elevul.',
    notVerified: 'Accesul poate fi acordat doar la un fișier verificat.',
    noStudentAccount: 'Elevul nu are un cont activ.',
    inactiveEnrollment: 'Înscrierea elevului la această disciplină nu mai este activă.',
    invalidLesson: 'Alege o lecție din fișa elevului pentru disciplina selectată.',
    invalidExpiry: 'Introdu o dată și o oră valide din viitor.',
    invalidTitle: 'Titlul lecției poate avea cel mult 200 de caractere.',
  },
};

type Validation = 'invalidLesson' | 'invalidExpiry' | 'invalidTitle';
type ShareFailure =
  Validation | 'duplicate' | 'notVerified' | 'noStudentAccount' | 'inactiveEnrollment';
const shareFailures: Readonly<Record<string, ShareFailure | undefined>> = {
  MATERIAL_ALREADY_SHARED: 'duplicate',
  MATERIAL_NOT_VERIFIED: 'notVerified',
  STUDENT_ACCOUNT_REQUIRED: 'noStudentAccount',
  ENROLLMENT_INACTIVE: 'inactiveEnrollment',
  MATERIAL_LESSON_NOT_APPLICABLE: 'invalidLesson',
  MATERIAL_EXPIRY_IN_PAST: 'invalidExpiry',
};

export function TeacherMaterialShare({
  file,
  zone,
  close,
  onShared,
}: {
  file: Schemas['TeacherMaterialDto'];
  zone: string;
  close: () => void;
  onShared: (enrollmentId: string) => void;
}) {
  const { locale } = useLocale();
  const t = copy[locale];
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const errorFeedback = useRef<HTMLParagraphElement>(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [validation, setValidation] = useState<Validation | null>(null);
  const [showCommandError, setShowCommandError] = useState(false);
  const verified = file.status === 'VERIFIED';
  const enrollments = useEndpoint<Schemas['TeacherEnrollmentsResponseDto']>(
    verified ? 'getTeacherEnrollments' : null,
  );
  const recipients = enrollments.data?.items ?? [];
  const recipient = recipients.find((item) => item.enrollmentId === enrollmentId);
  const student = useEndpoint<Schemas['TeacherStudentOverviewDto']>(
    recipient ? 'getTeacherStudentOverview' : null,
    { enrollmentId },
  );
  const overview = student.data?.enrollmentId === enrollmentId ? student.data : null;
  const lessonGroups = overview
    ? [
        { label: t.upcoming, lessons: overview.upcomingLessons },
        { label: t.recent, lessons: overview.recentLessons },
      ].filter(({ lessons }) => lessons.length)
    : [];
  const command = useCabinetCommand<ShareMaterialDto, ShareMaterialResponseDto, ShareFailure>(
    'shareTeacherMaterial',
    (result, body) => {
      if (result?.fileId !== file.fileId || !isRouteUuid(result.id)) return false;
      form.current?.reset();
      setEnrollmentId('');
      setLessonId('');
      onShared(body.enrollmentId);
      return true;
    },
    (code) => (Object.hasOwn(shareFailures, code) ? shareFailures[code] : undefined),
    { fileId: file.fileId },
  );
  const locked = command.busy || command.unresolved;
  const canRetry = command.unresolved && command.error !== 'retryExpired';
  const error = validation ?? (showCommandError && !command.busy ? command.error : null);

  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    if (command.busy) return;
    if (canRetry) retryButton.current?.focus();
    else if (command.error) errorFeedback.current?.focus();
  }, [canRetry, command.busy, command.error]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || !verified || !recipient) return;
    if (
      lessonId &&
      !lessonGroups.some(({ lessons }) => lessons.some((l) => l.lessonId === lessonId))
    ) {
      setValidation('invalidLesson');
      return;
    }
    const values = new FormData(event.currentTarget);
    const lessonTitle = lessonId ? String(values.get('lessonTitle') ?? '').trim() : '';
    const expiry = String(values.get('expiresAt') ?? '');
    const expiresAt = expiry ? localDateTimeToIso(expiry, zone) : null;
    if (expiry && (!expiresAt || Date.parse(expiresAt) <= Date.now())) {
      setValidation('invalidExpiry');
      const expiryField = event.currentTarget.elements.namedItem('expiresAt');
      if (expiryField instanceof HTMLInputElement) expiryField.focus();
      return;
    }
    if (lessonTitle.length > 200) {
      setValidation('invalidTitle');
      return;
    }
    setValidation(null);
    setShowCommandError(true);
    command.submit({
      enrollmentId: recipient.enrollmentId,
      canDownload: values.has('canDownload'),
      ...(lessonId ? { lessonId } : {}),
      ...(lessonTitle ? { lessonTitle } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    });
  }

  if (!verified) return null;
  return (
    <section className="cab-card cab-panel cab-lesson-stack" aria-labelledby={`${id}-heading`}>
      <div className="cab-subject-intro">
        <div>
          <h2 id={`${id}-heading`} tabIndex={-1} ref={heading}>
            {t.heading}
          </h2>
          <p className="cab-detail-subtitle">{file.fileName}</p>
        </div>
      </div>
      <form
        className="cab-lesson-stack"
        aria-labelledby={`${id}-heading`}
        onSubmit={submit}
        ref={form}
      >
        <fieldset
          className="cab-lesson-fields"
          disabled={locked}
          onChange={() => {
            setValidation(null);
            setShowCommandError(false);
          }}
        >
          <div className="cab-lesson-stack">
            <div className="cab-fields">
              <div className="cab-form-label">
                <label htmlFor={`${id}-enrollment`}>{t.recipient}</label>
                <select
                  id={`${id}-enrollment`}
                  name="enrollmentId"
                  value={enrollmentId}
                  required
                  disabled={!recipients.length}
                  onChange={(event) => {
                    setEnrollmentId(event.target.value);
                    setLessonId('');
                  }}
                >
                  <option value="">{t.chooseRecipient}</option>
                  {recipients.map((item) => (
                    <option key={item.enrollmentId} value={item.enrollmentId}>
                      {item.studentName} · {item.subjectName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cab-form-label">
                <label htmlFor={`${id}-expiry`}>{t.expiry}</label>
                <input
                  id={`${id}-expiry`}
                  type="datetime-local"
                  name="expiresAt"
                  aria-describedby={`${id}-zone${error === 'invalidExpiry' ? ` ${id}-error` : ''}`}
                  aria-invalid={error === 'invalidExpiry' || undefined}
                />
                <span id={`${id}-zone`}>
                  {t.expiryHint} · {zone}
                </span>
              </div>
            </div>
            {enrollments.pending && <p role="status">{t.loadingRecipients}</p>}
            {enrollments.error && (
              <div className="cab-empty cab-empty-error">
                <span role="alert">{t.recipientsUnavailable}</span>
                <button type="button" className="cab-text-button" onClick={enrollments.refresh}>
                  {t.retryRecipients}
                </button>
              </div>
            )}
            {enrollments.data && !recipients.length && <p role="status">{t.noRecipients}</p>}
            {recipient && (
              <div className="cab-lesson-stack">
                {student.pending && <p role="status">{t.loadingLessons}</p>}
                {!student.pending && !overview && (
                  <div className="cab-empty cab-empty-error">
                    <span role="alert">{t.lessonsUnavailable}</span>
                    <button type="button" className="cab-text-button" onClick={student.refresh}>
                      {t.retryLessons}
                    </button>
                  </div>
                )}
                {overview &&
                  (lessonGroups.length ? (
                    <div className="cab-fields">
                      <div className="cab-form-label">
                        <label htmlFor={`${id}-lesson`}>{t.lesson}</label>
                        <select
                          id={`${id}-lesson`}
                          name="lessonId"
                          value={lessonId}
                          onChange={(event) => setLessonId(event.target.value)}
                          aria-describedby={`${id}-lesson-scope${error === 'invalidLesson' ? ` ${id}-error` : ''}`}
                          aria-invalid={error === 'invalidLesson' || undefined}
                        >
                          <option value="">{t.noLesson}</option>
                          {lessonGroups.map(({ label, lessons }) => (
                            <optgroup key={label} label={label}>
                              {lessons.map((lesson) => (
                                <option key={lesson.lessonId} value={lesson.lessonId}>
                                  {formatDateTime(lesson.startsAt, locale, zone) ?? lesson.startsAt}
                                  {lesson.status === 'CANCELLED' &&
                                    ` · ${teacherCopy[locale].lessonStates.CANCELLED}`}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <span id={`${id}-lesson-scope`}>{t.lessonScope}</span>
                      </div>
                      {lessonId && (
                        <label className="cab-form-label" key={lessonId}>
                          {t.lessonTitle}
                          <input name="lessonTitle" maxLength={200} />
                        </label>
                      )}
                    </div>
                  ) : (
                    <p role="status">{t.noLessons}</p>
                  ))}
              </div>
            )}
            <label className="cab-lesson-checkbox">
              <input name="canDownload" type="checkbox" />
              {t.canDownload}
            </label>
          </div>
        </fieldset>
        {error && (
          <p
            id={`${id}-error`}
            className="cab-form-error"
            role="alert"
            tabIndex={-1}
            ref={errorFeedback}
          >
            {t[error]}
          </p>
        )}
        {command.busy && <p role="status">{t.submitting}</p>}
        {canRetry && (
          <div className="cab-empty">
            <p role="status">{t.unknown}</p>
            <button
              type="button"
              className="cab-button cab-secondary"
              disabled={command.busy}
              onClick={command.retry}
              ref={retryButton}
            >
              {t.retry}
            </button>
          </div>
        )}
        <div className="cab-form-actions">
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={locked}
            onClick={close}
          >
            {t.cancel}
          </button>
          <button type="submit" className="cab-button cab-primary" disabled={locked || !recipient}>
            {t.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
