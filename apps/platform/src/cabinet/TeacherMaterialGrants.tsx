import { useEffect, useId, useRef, useState } from 'react';
import type {
  RevokeMaterialResponseDto,
  TeacherSharedMaterialsDto,
} from '@online-school/api-contracts';
import { ConfirmDialog, formatDateTime, useLocale } from '@online-school/ui';
import { CabinetError } from './contract.js';
import { useCabinetCommand, useEndpoint } from './hooks.js';
import { isRouteUuid } from './studentSubjectRoutes.js';

type Grant = TeacherSharedMaterialsDto['items'][number];
type GrantStatus = 'active' | 'expired' | 'revoked';
type Rejection = 'alreadyRevoked' | 'missingGrant' | 'invalidResponse';
type Props = { enrollmentId: string; zone: string; onChanged?: () => void };

const copy = {
  ru: {
    heading: 'Выданные материалы',
    loading: 'Загружаем выданные материалы…',
    empty: 'Для этого ученика по выбранному предмету пока нет выданных материалов.',
    loadError: 'Не удалось загрузить выданные материалы.',
    inaccessible: 'Выданные материалы для выбранного ученика недоступны.',
    refresh: 'Обновить список',
    access: 'Тип доступа',
    view: 'Только просмотр',
    download: 'Просмотр и скачивание',
    active: 'Активен',
    expired: 'Истёк',
    revoked: 'Отозван',
    lesson: 'Урок',
    lessonLink: 'Открыть урок в новой вкладке',
    sharedAt: 'Выдан',
    expiresAt: 'Срок доступа',
    noExpiry: 'Без ограничения срока',
    revokedAt: 'Дата отзыва',
    revoke: 'Отозвать доступ',
    confirmTitle: 'Отозвать доступ к материалу?',
    confirm: 'Подтвердить отзыв',
    confirmDescription: (name: string) => `Доступ ученика к файлу «${name}» будет отозван.`,
    cancel: 'Отмена',
    busy: 'Отзываем доступ…',
    retry: 'Повторить отзыв',
    uncertain: 'Результат отзыва пока неизвестен. Повторите запрос для той же выдачи.',
    revokedNotice: 'Доступ к материалу отозван.',
    alreadyRevoked: 'Доступ к материалу уже был отозван.',
    missingGrant: 'Выдача материала больше недоступна.',
    invalidResponse: 'Не удалось проверить ответ об отзыве. Проверьте статус в списке.',
    rejected: 'Не удалось отозвать доступ к материалу.',
    forbidden: 'Для отзыва доступа недостаточно прав или сессия завершена.',
    throttled: 'Слишком много запросов. Попробуйте позже.',
    retryExpired: 'Срок повтора истёк. Обновите список и проверьте статус выдачи.',
  },
  ro: {
    heading: 'Materiale partajate',
    loading: 'Se încarcă materialele partajate…',
    empty: 'Elevul nu are încă materiale partajate la disciplina selectată.',
    loadError: 'Materialele partajate nu au putut fi încărcate.',
    inaccessible: 'Materialele partajate pentru elevul selectat nu sunt disponibile.',
    refresh: 'Actualizează lista',
    access: 'Tip de acces',
    view: 'Doar vizualizare',
    download: 'Vizualizare și descărcare',
    active: 'Activ',
    expired: 'Expirat',
    revoked: 'Revocat',
    lesson: 'Lecție',
    lessonLink: 'Deschide lecția într-o filă nouă',
    sharedAt: 'Partajat la',
    expiresAt: 'Valabil până la',
    noExpiry: 'Fără termen',
    revokedAt: 'Revocat la',
    revoke: 'Revocă accesul',
    confirmTitle: 'Revoci accesul la material?',
    confirm: 'Confirmă revocarea',
    confirmDescription: (name: string) => `Accesul elevului la fișierul „${name}” va fi revocat.`,
    cancel: 'Anulează',
    busy: 'Se revocă accesul…',
    retry: 'Reîncearcă revocarea',
    uncertain: 'Rezultatul revocării este încă necunoscut. Reîncearcă pentru același acces.',
    revokedNotice: 'Accesul la material a fost revocat.',
    alreadyRevoked: 'Accesul la material fusese deja revocat.',
    missingGrant: 'Accesul la material nu mai este disponibil.',
    invalidResponse: 'Răspunsul la revocare nu a putut fi verificat. Verifică starea în listă.',
    rejected: 'Accesul la material nu a putut fi revocat.',
    forbidden: 'Nu ai permisiunea de a revoca accesul sau sesiunea a expirat.',
    throttled: 'Prea multe solicitări. Încearcă mai târziu.',
    retryExpired: 'Termenul de reîncercare a expirat. Actualizează lista și verifică starea.',
  },
};

function GrantsForEnrollment({ enrollmentId, zone, onChanged }: Props) {
  const { locale } = useLocale();
  const t = copy[locale];
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [target, setTarget] = useState<Grant | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<'revokedNotice' | 'alreadyRevoked' | null>(null);
  const [, checkExpiry] = useState(0);
  const list = useEndpoint<TeacherSharedMaterialsDto>('getTeacherSharedMaterials', {
    enrollmentId,
  });
  const items =
    list.data?.enrollmentId === enrollmentId && Array.isArray(list.data.items)
      ? list.data.items
      : null;
  const readStatus = list.error instanceof CabinetError ? list.error.issue.status : undefined;
  const now = Date.now();
  const nextExpiry = items?.reduce((next, grant) => {
    const expires = grant.expiresAt ? Date.parse(grant.expiresAt) : NaN;
    return !grant.revokedAt && expires > now ? Math.min(expires, next) : next;
  }, Infinity);

  useEffect(() => {
    if (nextExpiry === undefined || !Number.isFinite(nextExpiry)) return;
    const delay = Math.max(0, Math.min(nextExpiry - Date.now(), 2_147_483_647));
    const timer = window.setTimeout(() => checkExpiry((value) => value + 1), delay);
    return () => window.clearTimeout(timer);
  }, [nextExpiry, now]);

  function reconciled(message: NonNullable<typeof notice>) {
    setNotice(message);
    setTarget(null);
    list.refresh();
    onChanged?.();
  }

  const revoke = useCabinetCommand<undefined, RevokeMaterialResponseDto, Rejection>(
    'revokeTeacherMaterial',
    (result) => {
      if (
        !result ||
        result.id !== target?.permissionId ||
        typeof result.revokedAt !== 'string' ||
        !Number.isFinite(Date.parse(result.revokedAt))
      ) {
        return false;
      }
      reconciled('revokedNotice');
      return true;
    },
    (code) => {
      if (code === 'MATERIAL_ALREADY_REVOKED') {
        reconciled('alreadyRevoked');
        return 'alreadyRevoked';
      }
      if (code === 'NOT_FOUND' || code === 'INVALID_RESPONSE') {
        list.refresh();
        return code === 'NOT_FOUND' ? 'missingGrant' : 'invalidResponse';
      }
    },
    target ? { permissionId: target.permissionId } : undefined,
  );

  // The command hook cannot replay a malformed HTTP response it classified as rejected.
  // Re-read before allowing further writes, and require the revoked state to be confirmed.
  const invalidResponse = revoke.error === 'invalidResponse' && target !== null;
  const revokedOnRead =
    invalidResponse &&
    items?.some((grant) => grant.permissionId === target.permissionId && Boolean(grant.revokedAt));
  const locked =
    confirming || revoke.busy || revoke.unresolved || (invalidResponse && !revokedOnRead);
  const failure =
    !confirming && !revoke.busy && target && revoke.error && !revokedOnRead
      ? t[revoke.error]
      : null;
  const uncertain = revoke.unresolved && revoke.error !== 'retryExpired';

  function time(value: string) {
    const label = formatDateTime(value, locale, zone);
    return label ? <time dateTime={value}>{label}</time> : '—';
  }

  return (
    <section className="cab-card cab-panel cab-lesson-stack" aria-labelledby={headingId}>
      <h2 id={headingId} ref={heading} tabIndex={-1}>
        {t.heading}
      </h2>
      {(notice || revokedOnRead) && <p role="status">{t[notice ?? 'revokedNotice']}</p>}
      {revoke.busy && <p role="status">{t.busy}</p>}
      {failure && (
        <p className="cab-form-error" role="alert">
          {failure}
        </p>
      )}
      {uncertain && (
        <div className="cab-empty">
          <p role="status">{t.uncertain}</p>
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={revoke.busy}
            onClick={revoke.retry}
          >
            {t.retry}
          </button>
        </div>
      )}
      {(invalidResponse || revoke.error === 'retryExpired') && items && !revokedOnRead && (
        <div>
          <button type="button" className="cab-text-button" onClick={list.refresh}>
            {t.refresh}
          </button>
        </div>
      )}
      {list.pending ? (
        <p className="cab-empty" role="status">
          {t.loading}
        </p>
      ) : !items ? (
        <div className="cab-empty cab-empty-error">
          <p role="alert">
            {readStatus === 401 || readStatus === 403 || readStatus === 404
              ? t.inaccessible
              : t.loadError}
          </p>
          <button type="button" className="cab-text-button" onClick={list.refresh}>
            {t.refresh}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="cab-empty">{t.empty}</p>
      ) : (
        <ul className="cab-session-list" role="list" aria-label={t.heading}>
          {items.map((grant) => {
            const status: GrantStatus = grant.revokedAt
              ? 'revoked'
              : grant.expiresAt && Date.parse(grant.expiresAt) <= now
                ? 'expired'
                : 'active';
            const lessonId = isRouteUuid(grant.lessonId) ? grant.lessonId : null;
            return (
              <li key={grant.permissionId}>
                <div className="cab-lesson-stack">
                  <h3 className="cab-lesson-ref">{grant.fileName}</h3>
                  <p>{t[status]}</p>
                </div>
                <dl className="cab-profile-facts">
                  <div>
                    <dt>{t.access}</dt>
                    <dd>{grant.canDownload ? t.download : t.view}</dd>
                  </div>
                  {(grant.lessonTitle || lessonId) && (
                    <div>
                      <dt>{t.lesson}</dt>
                      {grant.lessonTitle && <dd>{grant.lessonTitle}</dd>}
                      {lessonId && (
                        <dd>
                          <a
                            className="cab-inline-link"
                            href={'/teacher/lessons/' + lessonId}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t.lessonLink}
                          </a>
                        </dd>
                      )}
                    </div>
                  )}
                  <div>
                    <dt>{t.sharedAt}</dt>
                    <dd>{time(grant.sharedAt)}</dd>
                  </div>
                  <div>
                    <dt>{t.expiresAt}</dt>
                    <dd>{grant.expiresAt ? time(grant.expiresAt) : t.noExpiry}</dd>
                  </div>
                  {grant.revokedAt && (
                    <div>
                      <dt>{t.revokedAt}</dt>
                      <dd>{time(grant.revokedAt)}</dd>
                    </div>
                  )}
                </dl>
                {status !== 'revoked' && isRouteUuid(grant.permissionId) && (
                  <button
                    type="button"
                    className="cab-button cab-secondary"
                    disabled={locked}
                    onClick={(event) => {
                      if (locked) return;
                      trigger.current = event.currentTarget;
                      setNotice(null);
                      setTarget(grant);
                      setConfirming(true);
                    }}
                  >
                    {t.revoke}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(false);
            setTarget(null);
          }
        }}
        title={t.confirmTitle}
        description={t.confirmDescription(target?.fileName ?? '')}
        confirmLabel={t.confirm}
        cancelLabel={t.cancel}
        onConfirm={() => {
          if (!target || revoke.busy || revoke.unresolved) return;
          setConfirming(false);
          revoke.submit(undefined);
        }}
        destructive
        returnFocusRef={trigger}
        contentProps={{
          className: 'cab-dialog',
          onCloseAutoFocus: (event) => {
            if (trigger.current?.isConnected && !trigger.current.disabled) return;
            event.preventDefault();
            heading.current?.focus({ preventScroll: true });
          },
        }}
      />
    </section>
  );
}

export function TeacherMaterialGrants(props: Props) {
  return <GrantsForEnrollment key={props.enrollmentId} {...props} />;
}
