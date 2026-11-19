import { useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateTime, Icon, useLocale } from '@online-school/ui';
import { SubjectIcon } from './Brand.js';
import { LoadState } from './Operations.js';
import { MaterialAction, StudyPager } from './StudentLesson.js';
import { useEndpoint } from './hooks.js';

type Schemas = components['schemas'];

export function StudentMaterials({
  subjectId,
  zone,
  refreshAccess,
}: {
  subjectId?: string;
  zone: string;
  refreshAccess: () => void;
}) {
  const { locale } = useLocale();
  const [page, setPage] = useState(1);
  const materials = useEndpoint<Schemas['MaterialsResponseDto']>(
    'getStudentMaterials',
    {},
    { page, pageSize: 20, ...(subjectId ? { subjectId } : {}) },
  );
  if (materials.pending || materials.error)
    return (
      <LoadState refreshing={materials.pending} error={materials.error} retry={materials.refresh} />
    );
  if (!materials.data) return <LoadState />;
  return (
    <div className="cab-lesson-stack">
      {materials.data.items.length ? (
        <ul className="cab-subject-directory cab-material-directory">
          {materials.data.items.map((file) => (
            <li className="cab-card cab-panel cab-lesson-stack" key={file.fileId}>
              <div className="cab-material-name">
                {file.subjectId ? (
                  <SubjectIcon subject={file.subjectName} compact />
                ) : (
                  <Icon name="materials" size={21} />
                )}
                <h2>
                  {file.fileNameIsFallback
                    ? locale === 'ro'
                      ? 'Material'
                      : 'Материал'
                    : file.fileName}
                </h2>
              </div>
              <div className="cab-material-meta">
                <p>
                  {file.subjectId
                    ? file.subjectName
                    : locale === 'ro'
                      ? 'Fără disciplină'
                      : 'Без предмета'}
                </p>
                {file.lessonTitle && <p>{file.lessonTitle}</p>}
                <p>{file.sharedByTeacherName}</p>
                <time dateTime={file.sharedAt}>{formatDateTime(file.sharedAt, locale, zone)}</time>
              </div>
              <MaterialAction file={file} onAccessChange={refreshAccess} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="cab-empty">
          {locale === 'ro'
            ? 'Nu există încă materiale disponibile.'
            : 'Доступных материалов пока нет.'}
        </p>
      )}
      <StudyPager {...materials.data} change={setPage} />
    </div>
  );
}
