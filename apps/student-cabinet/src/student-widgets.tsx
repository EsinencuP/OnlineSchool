import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Icon as UIIcon, k8kEnabled } from '@online-school/ui';
import type {
  ManagerContactsDto,
  StudentSubjectDto,
  StudentSubjectSubscriptionDto,
} from '@online-school/api-contracts';
import { safeUrl, Status } from './components.js';
import { useStudentCopy } from './student-copy.js';
import { useSubscriptionCopy } from './subscription-copy.js';
import { formatStudentDate, StudentReadFreshness } from './student-presentation.js';
import { subjectSubscriptionRows } from './subscription-presentation.js';

export function ManagerContacts({
  contacts,
  unavailable = false,
}: {
  contacts?: ManagerContactsDto | undefined;
  unavailable?: boolean | undefined;
}) {
  const { copy } = useStudentCopy();
  if (unavailable)
    return (
      <p className="k8k-student-caption" role="status">
        {copy.managerUnavailable}
      </p>
    );
  const name = typeof contacts?.displayName === 'string' ? contacts.displayName.trim() : '';
  const whatsapp = safeUrl(contacts?.whatsapp, 'whatsapp');
  const telegram = safeUrl(contacts?.telegram, 'telegram');
  const phone = contacts?.phoneE164;
  const tel =
    typeof phone === 'string' && phone === phone.trim() && /^\+[1-9]\d{6,14}$/.test(phone)
      ? `tel:${phone}`
      : undefined;
  return (
    <>
      {name && (
        <p className="k8k-manager-identity">
          <Avatar name={name} aria-hidden="true" />
          <strong>{name}</strong>
        </p>
      )}
      <div className="manager-contacts k8k-contact-links">
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            WhatsApp <UIIcon name="external" />
          </a>
        )}
        {telegram && (
          <a href={telegram} target="_blank" rel="noopener noreferrer">
            Telegram <UIIcon name="external" />
          </a>
        )}
        {tel && <a href={tel}>{copy.callManager}</a>}
      </div>
      {!whatsapp && !telegram && !tel && <p className="k8k-student-caption">{copy.noContacts}</p>}
    </>
  );
}

export function StudentManagerCard({
  contacts,
  unavailable,
  id,
}: {
  contacts?: ManagerContactsDto | undefined;
  unavailable?: boolean | undefined;
  id?: string | undefined;
}) {
  const { copy } = useStudentCopy();
  return (
    <section id={id} className={`${k8kEnabled ? 'k8k-student-card' : 'panel'} k8k-manager-card`}>
      <h2>
        <UIIcon name="manager" /> {copy.manager}
      </h2>
      <p>{copy.managerInfo}</p>
      <ManagerContacts contacts={contacts} unavailable={unavailable} />
    </section>
  );
}

export function SubscriptionPlanFacts({
  plan,
  timeZone,
  showStatus = true,
}: {
  plan: StudentSubjectSubscriptionDto;
  timeZone: string;
  showStatus?: boolean;
}) {
  const { copy, locale } = useSubscriptionCopy();
  const { reasons } = useStudentCopy();
  const admission = plan.reasonCode === 'TEMPORARY_ADMISSION' ? plan.temporaryAdmission : null;
  return (
    <>
      {showStatus && (
        <>
          <Status value={plan.displayStatus} />
          <p className="k8k-student-caption">{reasons[plan.reasonCode]}</p>
        </>
      )}
      <dl className="k8k-subscription-facts">
        <dt>{copy.paidRemaining}</dt>
        <dd>{plan.paidLessonsRemaining ?? copy.unknown}</dd>
        {plan.validUntil && (
          <>
            <dt>{copy.validUntil}</dt>
            <dd>
              <time dateTime={plan.validUntil}>
                {formatStudentDate(plan.validUntil, timeZone, false, locale)}
              </time>
            </dd>
          </>
        )}
        {plan.displayStatus === 'FROZEN' && plan.frozenUntil && (
          <>
            <dt>{copy.frozenUntil}</dt>
            <dd>
              <time dateTime={plan.frozenUntil}>
                {formatStudentDate(plan.frozenUntil, timeZone, false, locale)}
              </time>
            </dd>
          </>
        )}
      </dl>
      {admission && (
        <div className="k8k-subscription-admission">
          <strong>{copy.temporary}</strong>
          <dl className="k8k-subscription-facts">
            <dt>{copy.remaining}</dt>
            <dd>{admission.lessonsRemaining}</dd>
            <dt>{copy.maxLessons}</dt>
            <dd>{admission.maxLessons}</dd>
            <dt>{copy.admissionUntil}</dt>
            <dd>
              <time dateTime={admission.validUntil}>
                {formatStudentDate(admission.validUntil, timeZone, true, locale)}
              </time>
            </dd>
          </dl>
        </div>
      )}
    </>
  );
}

export function SubjectSubscriptionRows({
  item,
  timeZone,
  compact = false,
  showStatus = true,
}: {
  item: StudentSubjectDto;
  timeZone: string;
  compact?: boolean;
  showStatus?: boolean;
}) {
  const { copy, reasons } = useStudentCopy();
  const fresh = useContext(StudentReadFreshness);
  const rows = subjectSubscriptionRows(item);
  return (compact ? rows.slice(0, 1) : rows).map(
    ({ plan, href }) =>
      (plan || showStatus) && (
        <div className="k8k-subject-subscription" key={plan?.subscriptionId ?? item.subjectId}>
          {plan ? (
            <SubscriptionPlanFacts plan={plan} timeZone={timeZone} showStatus={showStatus} />
          ) : (
            <>
              <Status value={item.displayStatus} />
              <p className="k8k-student-caption">{reasons[item.reasonCode]}</p>
            </>
          )}
          {href && fresh && (
            <Link className="k8k-student-link" to={href}>
              {copy.subscriptionDetails} <UIIcon name="arrow" />
            </Link>
          )}
        </div>
      ),
  );
}

export function SubjectSubscriptions({
  items,
  timeZone,
}: {
  items: readonly StudentSubjectDto[];
  timeZone: string;
}) {
  const { copy } = useSubscriptionCopy();
  return (
    <>
      {items.map((item) => (
        <article className="k8k-subscription-summary" key={item.subjectId}>
          <h3>{item.subjectName}</h3>
          <SubjectSubscriptionRows item={item} timeZone={timeZone} compact />
        </article>
      ))}
      {!items.length && <p>{copy.noSubjects}</p>}
    </>
  );
}
