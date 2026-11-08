import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon, useLocale } from '@online-school/ui';
import type { PlainMessageKey } from '@online-school/ui';
import { useIdentityCopy } from './identity-copy.js';

export function StudentBreadcrumbs() {
  const { t } = useLocale();
  const identity = useIdentityCopy();
  const { pathname } = useLocation();
  const section = pathname.split('/')[2] ?? '';
  const labels: Record<string, PlainMessageKey> = {
    lessons: 'schedule',
    homework: 'nav.homework',
    subjects: 'nav.studentSubjects',
    skills: 'skills',
    reports: 'reports',
    materials: 'materials',
    subscription: 'subscription',
    help: 'nav.studentHelp',
    profile: 'profile',
    security: 'student.security',
  };
  return (
    <nav className="k8k-breadcrumbs" aria-label={identity('breadcrumbs')}>
      <Link to="/student">{t('home')}</Link>
      <Icon name="arrow" size={16} />
      <span aria-current="page">{t(labels[section] ?? 'cabinetStudent')}</span>
    </nav>
  );
}

export function StudentPageHeading({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="k8k-page-heading">
      <div>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="k8k-page-tools">{actions}</div>}
    </div>
  );
}

export function StudentHelpCard() {
  const text = useIdentityCopy();
  return (
    <section className="k8k-support-card k8k-support-info">
      <h2>
        <Icon name="manager" size={28} />
        {text('help')}
      </h2>
      <p>{text('helpText')}</p>
      <Link className="k8k-support-action" to="/student/help">
        {text('contact')}
        <Icon name="arrow" />
      </Link>
    </section>
  );
}

export function HomeworkHelpCard() {
  const text = useIdentityCopy();
  return (
    <section className="k8k-support-card k8k-support-warm">
      <h2>{text('submitHelp')}</h2>
      <ol className="k8k-help-steps">
        {text('submitSteps')
          .split('|')
          .map((step) => (
            <li key={step}>{step}</li>
          ))}
      </ol>
    </section>
  );
}
