import type { WorkspaceCoverageDto } from '@online-school/api-contracts';
import { useLocale } from '@online-school/ui';
import './staff-coverage.css';

/** A bounded read sample must not be presented as a school-wide total. */
export function StaffCoverageNote({ coverage }: { coverage?: WorkspaceCoverageDto | undefined }) {
  const { locale, t } = useLocale();
  return (
    <small
      className="staff-coverage-note"
      data-staff-coverage
      data-truncated={coverage?.pageInfo.hasMore || undefined}
    >
      {locale === 'ro' ? 'În selecția încărcată. ' : 'В загруженной выборке. '}
      {t('tableTotalUnknown')}
      {'.'}
      {coverage?.pageInfo.hasMore &&
        (locale === 'ro'
          ? ' Sunt afișate doar o parte din înregistrări.'
          : ' Показана только часть записей.')}
    </small>
  );
}
