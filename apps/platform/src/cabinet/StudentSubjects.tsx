import type { ReactNode } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateTime, Icon, useLocale } from '@online-school/ui';
import type { IconName } from '@online-school/ui';
import { SubjectIcon } from './Brand.js';
import { CabinLink } from './Home.js';
import { LoadState } from './Operations.js';
import { useEndpoint } from './hooks.js';
import {
  studentSubscriptionUrl,
  subjectHub,
  subjectSkills,
  subjectUrl,
} from './studentSubjectRoutes.js';

type Schemas = components['schemas'];
type StudentSubject = Schemas['StudentSubjectDto'];
type Navigate = (url: string) => void;

const copy = {
  title: ['Мои предметы', 'Disciplinele mele'],
  all: ['Все предметы', 'Toate disciplinele'],
  back: ['К предмету', 'Înapoi la disciplină'],
  skills: ['Карта навыков', 'Harta competențelor'],
  lessons: ['Расписание предмета', 'Orarul disciplinei'],
  homework: ['Все домашние задания', 'Toate temele'],
  materials: ['Материалы предмета', 'Materialele disciplinei'],
  subscription: ['Абонемент', 'Abonament'],
  plans: ['Абонементы', 'Abonamente'],
  paid: ['Осталось оплаченных уроков', 'Lecții plătite rămase'],
  valid: ['Действует до', 'Valabil până la'],
  frozen: ['Заморожен до', 'Suspendat până la'],
  temporaryUntil: ['Временный допуск до', 'Acces temporar până la'],
  remaining: ['Осталось уроков по допуску', 'Lecții rămase cu acces temporar'],
  unknown: ['Нет данных', 'Fără date'],
  noPlans: ['По предмету пока нет абонемента.', 'Disciplina nu are încă un abonament.'],
  noSubjects: ['В вашем кабинете пока нет предметов.', 'Nu ai încă discipline în cont.'],
  unavailable: ['Предмет недоступен.', 'Disciplina nu este disponibilă.'],
  ACTIVE: ['Активен', 'Activ'],
  FROZEN: ['Заморожен', 'Suspendat'],
  EXPIRED: ['Истёк', 'Expirat'],
  LIMITED: ['Ограничен', 'Limitat'],
  NONE: ['Без доступа', 'Fără acces'],
  PAID_RIGHTS: ['Доступ по оплаченному абонементу.', 'Acces prin abonamentul plătit.'],
  PERIOD_EXPIRED: ['Период абонемента закончился.', 'Perioada abonamentului s-a încheiat.'],
  ENROLLMENT_ENDED: ['Обучение по предмету завершено.', 'Studiul disciplinei s-a încheiat.'],
  ENROLLMENT_PAUSED: [
    'Обучение по предмету приостановлено.',
    'Studiul disciplinei este suspendat.',
  ],
  NO_SUBSCRIPTION: ['Абонемента пока нет.', 'Nu există încă un abonament.'],
  TEMPORARY_ADMISSION: ['Действует временный допуск.', 'Accesul temporar este activ.'],
  PAYMENT_OR_ADMISSION_REQUIRED: [
    'Для занятий требуется оплата или временный допуск.',
    'Lecțiile necesită plată sau acces temporar.',
  ],
  NO_PAID_RIGHTS: ['Оплаченные уроки закончились.', 'Lecțiile plătite s-au epuizat.'],
  RIGHTS_UNKNOWN: [
    'Доступ к занятиям пока не подтверждён.',
    'Accesul la lecții nu este încă confirmat.',
  ],
} as const;

function useSubjectCopy() {
  const { locale } = useLocale();
  const text = (key: keyof typeof copy) => copy[key][locale === 'ro' ? 1 : 0];
  return { locale, text };
}

export function SubjectBack({ id, navigate }: { id?: string; navigate: Navigate }) {
  const { text } = useSubjectCopy();
  return (
    <CabinLink
      to={id ? subjectUrl(id) : subjectHub}
      navigate={navigate}
      className="cab-inline-link"
    >
      {text(id ? 'back' : 'all')}
    </CabinLink>
  );
}

export function SubjectUnavailable({ navigate }: { navigate: Navigate }) {
  const { text } = useSubjectCopy();
  return (
    <div className="cab-empty cab-empty-error" role="alert">
      <span>{text('unavailable')}</span>
      <SubjectBack navigate={navigate} />
    </div>
  );
}

function useSubjects(enabled = true) {
  return useEndpoint<Schemas['StudentSubjectsResponseDto']>(enabled ? 'getStudentSubjects' : null);
}

export function SubjectScope({
  id,
  capability,
  navigate,
  children,
}: {
  id: string;
  capability?: keyof StudentSubject['capabilities'];
  navigate: Navigate;
  children: (item: StudentSubject) => ReactNode;
}) {
  const subjects = useSubjects(Boolean(id));
  if (subjects.pending || subjects.error)
    return (
      <LoadState refreshing={subjects.pending} error={subjects.error} retry={subjects.refresh} />
    );
  const item = subjects.data?.items.find((subject) => subject.subjectId === id);
  if (!item || (capability && !item.capabilities[capability]))
    return <SubjectUnavailable navigate={navigate} />;
  return children(item);
}

const tones: Record<StudentSubject['displayStatus'], string> = {
  ACTIVE: 'mint',
  LIMITED: 'peach',
  FROZEN: 'blue',
  EXPIRED: 'rose',
  NONE: 'violet',
};

function AccessStatus({ status }: { status: StudentSubject['displayStatus'] }) {
  const { text } = useSubjectCopy();
  return <span className={'cab-status cab-tone-' + tones[status]}>{text(status)}</span>;
}

export function StudentSubjects({
  selected,
  zone,
  navigate,
}: {
  selected: string | null;
  zone: string;
  navigate: Navigate;
}) {
  return selected === null ? (
    <SubjectDirectory navigate={navigate} />
  ) : (
    <SubjectScope id={selected} navigate={navigate}>
      {(item) => (
        <div className="cab-lesson-stack">
          <SubjectBack navigate={navigate} />
          <SubjectOverview item={item} zone={zone} navigate={navigate} />
        </div>
      )}
    </SubjectScope>
  );
}

function SubjectDirectory({ navigate }: { navigate: Navigate }) {
  const { text } = useSubjectCopy();
  const subjects = useSubjects();
  const colors = ['violet', 'mint', 'peach', 'blue', 'rose'];
  return (
    <section className="cab-lesson-stack" aria-label={text('title')}>
      <div className="cab-subject-toolbar">
        <CabinLink to={subjectSkills} navigate={navigate} className="cab-button cab-secondary">
          <Icon name="skills" size={18} /> {text('skills')}
        </CabinLink>
      </div>
      {subjects.pending || subjects.error ? (
        <LoadState refreshing={subjects.pending} error={subjects.error} retry={subjects.refresh} />
      ) : subjects.data?.items.length ? (
        <ul className="cab-subject-directory">
          {subjects.data.items.map((item, index) => (
            <li key={item.subjectId}>
              <CabinLink
                to={subjectUrl(item.subjectId)}
                navigate={navigate}
                className={'cab-subject-entry cab-tone-' + colors[index % colors.length]}
              >
                <SubjectIcon subject={item.subjectName} />
                <strong>{item.subjectName}</strong>
                <AccessStatus status={item.displayStatus} />
                <Icon name="arrow" size={20} />
              </CabinLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cab-empty">{text('noSubjects')}</p>
      )}
    </section>
  );
}

function SubjectOverview({
  item,
  zone,
  navigate,
}: {
  item: StudentSubject;
  zone: string;
  navigate: Navigate;
}) {
  const { locale, text } = useSubjectCopy();
  const { subjectId, capabilities } = item;
  const scope = new URLSearchParams({ subjectId });
  const actions: { label: string; icon: IconName; to: string }[] = [];
  if (capabilities.canOpenLessons)
    actions.push({ label: text('lessons'), icon: 'calendar', to: '/student/lessons?' + scope });
  if (capabilities.canViewMaterials)
    actions.push({
      label: text('materials'),
      icon: 'materials',
      to: '/student/materials?' + scope,
    });
  if (capabilities.canViewHomework)
    actions.push({
      label: text('homework'),
      icon: 'tasks',
      to: '/student/homework?' + new URLSearchParams({ fromSubjectId: subjectId }),
    });
  actions.push({ label: text('skills'), icon: 'skills', to: subjectSkills + '?' + scope });
  const date = (value: string) => formatDateTime(value, locale, zone) ?? text('unknown');

  return (
    <>
      <section className="cab-card cab-panel cab-subject-intro cab-tone-violet">
        <SubjectIcon subject={item.subjectName} />
        <div>
          <h2>{item.subjectName}</h2>
          {item.reasonCode !== 'FROZEN' && <p>{text(item.reasonCode)}</p>}
          <AccessStatus status={item.displayStatus} />
        </div>
      </section>
      <div className="cab-action-grid cab-subject-actions">
        {actions.map(({ to, label, icon }) => (
          <CabinLink key={to} to={to} navigate={navigate} className="cab-button cab-secondary">
            <Icon name={icon} size={18} /> {label} <Icon name="arrow" size={15} />
          </CabinLink>
        ))}
      </div>
      <section className="cab-card cab-panel cab-lesson-stack">
        <h2>{text('plans')}</h2>
        {item.subscriptions.length ? (
          <ul className="cab-lesson-resources cab-subject-plans">
            {item.subscriptions.map((plan) => (
              <li key={plan.subscriptionId}>
                <AccessStatus status={plan.displayStatus} />
                <dl className="cab-lesson-balance">
                  <div>
                    <dt>{text('paid')}</dt>
                    <dd>{plan.paidLessonsRemaining ?? text('unknown')}</dd>
                  </div>
                  {plan.validUntil && (
                    <div>
                      <dt>{text('valid')}</dt>
                      <dd>{date(plan.validUntil)}</dd>
                    </div>
                  )}
                  {plan.frozenUntil && (
                    <div>
                      <dt>{text('frozen')}</dt>
                      <dd>{date(plan.frozenUntil)}</dd>
                    </div>
                  )}
                  {plan.temporaryAdmission && (
                    <>
                      <div>
                        <dt>{text('remaining')}</dt>
                        <dd>{plan.temporaryAdmission.lessonsRemaining}</dd>
                      </div>
                      <div>
                        <dt>{text('temporaryUntil')}</dt>
                        <dd>{date(plan.temporaryAdmission.validUntil)}</dd>
                      </div>
                    </>
                  )}
                </dl>
                {capabilities.canOpenSubscription && (
                  <CabinLink
                    to={studentSubscriptionUrl(plan.subscriptionId, subjectId)}
                    navigate={navigate}
                    className="cab-inline-link"
                  >
                    {text('subscription')} <Icon name="arrow" size={16} />
                  </CabinLink>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cab-empty">{text('noPlans')}</p>
        )}
      </section>
    </>
  );
}
