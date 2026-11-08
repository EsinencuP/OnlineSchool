import { Link } from 'react-router-dom';
import { Icon as UIIcon } from '@online-school/ui';
import type { ManagerContactsDto, SubscriptionDetailsDto } from '@online-school/api-contracts';
import { date, safeUrl, Status } from './components.js';
import { useStudentCopy } from './student-copy.js';

export function StudentManagerCard({ contacts }: { contacts?: ManagerContactsDto | undefined }) {
  const { copy } = useStudentCopy();
  const whatsapp = safeUrl(contacts?.whatsapp, 'whatsapp');
  const telegram = safeUrl(contacts?.telegram, 'telegram');
  return (
    <section className="k8k-student-card k8k-manager-card">
      <h2>
        <UIIcon name="manager" /> {copy.manager}
      </h2>
      <p>{copy.managerInfo}</p>
      <div className="k8k-contact-links">
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noreferrer">
            WhatsApp <UIIcon name="external" />
          </a>
        )}
        {telegram && (
          <a href={telegram} target="_blank" rel="noreferrer">
            Telegram <UIIcon name="external" />
          </a>
        )}
      </div>
      {!whatsapp && !telegram && <p className="k8k-student-caption">{copy.noContacts}</p>}
    </section>
  );
}

// UI adapter shape, NOT a new API contract. Current student DTOs cannot supply this source.
export interface SubjectSubscriptionView {
  subjectId: string;
  subjectName: string;
  subscription: SubscriptionDetailsDto;
}
export function SubjectSubscriptions({
  enabled,
  items,
}: {
  enabled: boolean;
  items?: readonly SubjectSubscriptionView[];
}) {
  if (!enabled || !items) return null;
  return (
    <section className="k8k-student-card" data-module="DASH-STU-05">
      <h2>Абонементы по предметам</h2>
      {items.length ? (
        items.map(({ subjectId, subjectName, subscription }) => (
          <article
            className="k8k-subject-subscription"
            key={`${subjectId}:${subscription.subscriptionId ?? 'none'}`}
          >
            <h3>{subjectName}</h3>
            <Status value={subscription.status} />
            {subscription.lessonsRemaining !== null && (
              <p>
                Подтверждённых занятий: <strong>{subscription.lessonsRemaining}</strong>
              </p>
            )}
            {subscription.validUntil && <p>Срок: до {date(subscription.validUntil)}</p>}
            {subscription.isFrozen && (
              <p>
                Заморожен{subscription.frozenUntil ? ` до ${date(subscription.frozenUntil)}` : ''}.
                Ранее выданные материалы и задания доступны в пределах твоих прав.
              </p>
            )}
            {subscription.subscriptionId && (
              <Link
                className="k8k-student-link"
                to={`/student/subscription?subscriptionId=${encodeURIComponent(subscription.subscriptionId)}`}
              >
                Подробнее <UIIcon name="arrow" />
              </Link>
            )}
          </article>
        ))
      ) : (
        <p>Абонементы по предметам пока не оформлены.</p>
      )}
    </section>
  );
}
