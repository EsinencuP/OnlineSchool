import { Link } from 'react-router-dom';
import { Avatar, Icon } from '@online-school/ui';
import { getStudentSkillAudit } from '@online-school/api-contracts';
import type { SubjectSkillMapDto } from '@online-school/api-contracts';
import { useStudentQuery } from './api.js';
import { QueryState } from './components.js';
import { useIdentityCopy } from './identity-copy.js';
import { useSkillCopy, formatSkillDate } from './skill-copy.js';
import { useMe } from './Layout.js';
import { subjectHref, subjectHub } from './pages/Subjects.js';

export function SkillFocus({ map }: { map: SubjectSkillMapDto }) {
  const text = useIdentityCopy();
  const { locale } = useSkillCopy();
  const { timeZone } = useMe();
  const skill = map.skills.find(
    (item) => item.status === 'FAMILIARIZING' || item.status === 'PRACTICING',
  );
  const query = useStudentQuery(
    ['skill-history', skill?.skillId, 1],
    (o) => getStudentSkillAudit({ skillId: skill!.skillId, page: 1 }, o),
    !!skill,
  );
  const feedback = query.data?.items.find((entry) => entry.comment?.trim());
  return (
    <>
      <section className="k8k-knowledge-feature">
        <h2>
          <Icon name="brand" size={28} />
          {text(skill ? 'skillFocus' : 'subjectFocus')}
        </h2>
        <h3>{skill?.name ?? map.subjectName}</h3>
        <p>{map.subjectName}</p>
        <Link className="k8k-main-action" to={subjectHref(subjectHub, map.subjectId)}>
          {text('openSubject')}
          <Icon name="arrow" />
        </Link>
      </section>
      {skill && (
        <section className="k8k-student-card k8k-feedback-card">
          <h2>{text('feedback')}</h2>
          <QueryState query={query}>
            {feedback ? (
              <>
                <div className="k8k-feedback-author">
                  {feedback.teacherName && (
                    <Avatar name={feedback.teacherName} aria-hidden="true" />
                  )}
                  <div>
                    {feedback.teacherName && <strong>{feedback.teacherName}</strong>}
                    <time dateTime={feedback.changedAt}>
                      {formatSkillDate(feedback.changedAt, timeZone, locale)}
                    </time>
                  </div>
                </div>
                <blockquote className="preserve-lines">{feedback.comment}</blockquote>
              </>
            ) : (
              <p>{text('noFeedback')}</p>
            )}
          </QueryState>
        </section>
      )}
    </>
  );
}
