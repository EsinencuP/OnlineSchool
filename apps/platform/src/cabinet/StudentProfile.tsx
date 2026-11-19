import { useState } from 'react';
import type { FormEvent } from 'react';
import type { components } from '@online-school/api-contracts';
import { Icon } from '@online-school/ui';
import { CabinLink } from './Home.js';
import { useStudentAccountAction } from './studentAccountAction.js';
import { accountFailure, accountOutcomeUnknown, useAccountCopy } from './studentAccountCopy.js';
import type { AccountMessage } from './studentAccountCopy.js';
import { isRouteUuid } from './studentSubjectRoutes.js';

type Schemas = components['schemas'];
type EditableProfile = Pick<Schemas['StudentMeResponseDto'], 'displayName' | 'avatarUrl'>;
type Update = { key: string; body: Schemas['UpdateProfileDto'] };

export function StudentAvatar({ name, url }: { name: string; url?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src =
    url && /^\/api\/v1\/student\/profile\/avatar(?:\?v=[0-9a-f-]{36})?$/i.test(url) ? url : null;
  if (src && failed !== src) return <img alt="" src={src} onError={() => setFailed(src)} />;
  return (
    <>
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => Array.from(part)[0])
        .join('')
        .toUpperCase() || '2K'}
    </>
  );
}

export function StudentProfile({
  name,
  avatarUrl,
  email,
  zone,
  navigate,
  onSaved,
}: {
  name: string;
  avatarUrl: string | null;
  email: string;
  zone: string;
  navigate: (url: string) => void;
  onSaved: (profile: EditableProfile) => void;
}) {
  const { text } = useAccountCopy();
  const [alias, setAlias] = useState(name);
  const [avatar, setAvatar] = useState('');
  const [message, setMessage] = useState<AccountMessage | null>(null);
  const [pending, setPending] = useState<Update | null>(null);
  const { busy, run } = useStudentAccountAction();
  const trimmed = alias.trim();

  async function save(update: Update) {
    setMessage(null);
    const result = await run<Schemas['StudentProfileDto']>('updateStudentProfile', update);
    if (!result) return;
    if (result.ok && typeof result.data?.displayName === 'string') {
      setAlias(result.data.displayName);
      setAvatar('');
      setPending(null);
      setMessage('saved');
      onSaved(result.data);
    } else if (result.ok || accountOutcomeUnknown(result.error)) {
      setPending(update);
      setMessage('profileUnknown');
    } else {
      setPending(null);
      setMessage(accountFailure(result.error));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || pending) return;
    const avatarId = avatar.trim();
    if (
      !trimmed ||
      trimmed.length > 100 ||
      Array.from(trimmed).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    ) {
      setMessage('invalidName');
      return;
    }
    if (avatarId && !isRouteUuid(avatarId)) {
      setMessage('invalidAvatar');
      return;
    }
    const body = {
      ...(trimmed !== name ? { displayName: trimmed } : {}),
      ...(avatarId ? { avatarFileId: avatarId } : {}),
    };
    if (Object.keys(body).length) void save({ key: crypto.randomUUID(), body });
  }

  return (
    <div className="cab-lesson-grid cab-profile-grid">
      <section className="cab-card cab-panel cab-lesson-stack cab-profile-overview">
        <span className="cab-avatar cab-profile-avatar">
          <StudentAvatar name={name} url={avatarUrl} />
        </span>
        <h2>{name}</h2>
        <dl className="cab-profile-facts">
          {email && (
            <div>
              <dt>{text('email')}</dt>
              <dd>{email}</dd>
            </div>
          )}
          <div>
            <dt>{text('timezone')}</dt>
            <dd>{zone}</dd>
          </div>
        </dl>
        <CabinLink to="/student/security" navigate={navigate} className="cab-inline-link">
          {text('security')} <Icon name="arrow" size={16} />
        </CabinLink>
      </section>
      <section className="cab-card cab-panel cab-lesson-stack">
        <h2>{text('edit')}</h2>
        <form className="cab-lesson-stack" onSubmit={submit}>
          <label className="cab-form-label">
            <span>{text('alias')}</span>
            <input
              name="displayName"
              autoComplete="nickname"
              value={alias}
              maxLength={100}
              required
              disabled={busy || !!pending}
              onChange={(event) => setAlias(event.target.value)}
            />
          </label>
          <p className="cab-account-hint">{text('aliasHint')}</p>
          <details className="cab-disclosure">
            <summary>{text('avatar')}</summary>
            <p className="cab-account-hint">{text('avatarHint')}</p>
            <label className="cab-form-label">
              <span>{text('avatarId')}</span>
              <input
                name="avatarFileId"
                autoComplete="off"
                value={avatar}
                maxLength={36}
                disabled={busy || !!pending}
                onChange={(event) => setAvatar(event.target.value)}
              />
            </label>
          </details>
          {message && (
            <p
              className={message === 'saved' ? 'cab-account-hint' : 'cab-form-error'}
              role={message === 'saved' ? 'status' : 'alert'}
            >
              {text(message)}
            </p>
          )}
          {pending ? (
            <button
              type="button"
              className="cab-button cab-secondary"
              disabled={busy}
              onClick={() => void save(pending)}
            >
              {text(busy ? 'busy' : 'retryProfile')}
            </button>
          ) : (
            <button
              type="submit"
              className="cab-button cab-primary"
              disabled={busy || (trimmed === name && !avatar.trim())}
            >
              {text(busy ? 'busy' : 'save')}
            </button>
          )}
        </form>
      </section>
    </div>
  );
}
