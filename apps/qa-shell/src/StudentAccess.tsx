import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { changeStudentPassword, getStudentMe, mutation, requestOptions } from './api.js';
import type { StudentMeResponseDto, SessionResponse } from './api.js';

function contact(value: string | undefined, kind: 'whatsapp' | 'telegram') {
  const pattern =
    kind === 'whatsapp'
      ? /^https:\/\/wa\.me\/[1-9]\d{6,14}\/?$/
      : /^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}\/?$/;
  return value && pattern.test(value) ? value : null;
}
export function StudentAccess({
  session,
  onRefresh,
  onLogout,
}: {
  session: SessionResponse;
  onRefresh(): Promise<void>;
  onLogout(): Promise<void>;
}) {
  const [profile, setProfile] = useState<StudentMeResponseDto | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null),
    sequence = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++sequence.current;
    setLoading(true);
    setError('');
    const result = await getStudentMe(requestOptions(signal));
    if (signal?.aborted || version !== sequence.current) return;
    if (result.ok) setProfile(result.value);
    else {
      setProfile(null);
      setError(
        result.error.status === 401
          ? 'Войдите в аккаунт ещё раз.'
          : 'Не удалось загрузить кабинет. Попробуйте ещё раз.',
      );
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
      sequence.current++;
    };
  }, [session, load]);
  const stage = loading
    ? 'loading'
    : profile?.mustChangePassword
      ? 'password'
      : profile && !profile.hasActiveAccess
        ? 'suspended'
        : profile
          ? 'active'
          : 'error';
  useEffect(() => {
    if (!loading && profile) window.location.replace('/student');
  }, [loading, profile]);
  useEffect(() => {
    if (stage !== 'loading') heading.current?.focus();
  }, [stage]);
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = new FormData(form),
      currentPassword = String(data.get('currentPassword') ?? ''),
      newPassword = String(data.get('newPassword') ?? '');
    form.reset();
    setBusy(true);
    setError('');
    try {
      const result = await mutation((options) =>
        changeStudentPassword({ currentPassword, newPassword }, options),
      );
      if (!result.ok) {
        setError(
          result.error.code === 'CURRENT_PASSWORD_INVALID'
            ? 'Текущий пароль указан неверно.'
            : result.error.status === 429
              ? 'Слишком много попыток. Попробуйте позже.'
              : 'Не удалось изменить пароль. Попробуйте ещё раз.',
        );
        return;
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }
  const title =
    stage === 'password'
      ? 'Задайте новый пароль'
      : stage === 'suspended'
        ? 'Доступ приостановлен'
        : stage === 'active'
          ? 'Ваш кабинет'
          : stage === 'loading'
            ? 'Загружаем кабинет…'
            : 'Кабинет временно недоступен';
  const whatsapp = contact(profile?.managerContacts?.whatsapp, 'whatsapp'),
    telegram = contact(profile?.managerContacts?.telegram, 'telegram');
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          Online Academy
        </a>
        <button className="quiet" disabled={busy} onClick={() => void onLogout()}>
          Выйти
        </button>
      </header>
      <main className="shell student-access" aria-busy={loading}>
        <section className="panel student-access-card" aria-labelledby="student-access-heading">
          <p className="eyebrow">Личный кабинет ученика</p>
          <h1 id="student-access-heading" ref={heading} tabIndex={-1}>
            {title}
          </h1>
          {stage === 'password' && (
            <>
              <p>Перед первым входом замените временный пароль на собственный.</p>
              <form onSubmit={(event) => void change(event)} className="student-password-form">
                <label className="field">
                  <span>Текущий пароль</span>
                  <input
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={256}
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  <span>Новый пароль</span>
                  <input
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    pattern={'(?=.*[A-Za-z])(?=.*\\d).+'}
                    aria-describedby="student-password-hint"
                    disabled={busy}
                  />
                </label>
                <p id="student-password-hint" className="hint">
                  От 8 до 128 символов, латинские буквы и цифры.
                </p>
                <button type="submit" disabled={busy}>
                  {busy ? 'Сохраняем…' : 'Изменить пароль'}
                </button>
              </form>
            </>
          )}
          {stage === 'suspended' && (
            <>
              <p>Для продолжения обучения свяжитесь с вашим менеджером.</p>
              <div className="student-contact-links">
                {whatsapp && (
                  <a href={whatsapp} target="_blank" rel="noreferrer">
                    Написать в WhatsApp
                  </a>
                )}
                {telegram && (
                  <a href={telegram} target="_blank" rel="noreferrer">
                    Написать в Telegram
                  </a>
                )}
              </div>
              {!whatsapp && !telegram && (
                <p className="hint">
                  Контакты менеджера пока не указаны. Обратитесь в школу привычным способом.
                </p>
              )}
            </>
          )}
          {stage === 'active' && (
            <>
              <h2>{profile?.displayName}</h2>
              <p>Ваш доступ к обучению активен.</p>
            </>
          )}
          {error && (
            <p role="alert" className="student-access-error">
              {error}
            </p>
          )}
          {stage === 'error' && (
            <button disabled={loading} onClick={() => void load()}>
              Повторить загрузку
            </button>
          )}
        </section>
      </main>
    </>
  );
}
