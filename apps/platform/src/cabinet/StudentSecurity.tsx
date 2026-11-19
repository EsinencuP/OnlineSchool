import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { components } from '@online-school/api-contracts';
import { leaveSession, verifySessionOutcome } from '@online-school/account-ui';
import { ConfirmDialog, formatDateTime, Icon } from '@online-school/ui';
import { CabinetError } from './contract.js';
import { CabinLink } from './Home.js';
import { useCabinetAction, useEndpoint } from './hooks.js';
import {
  accountFailure,
  accountOutcomeUnknown,
  studentPasswordPath,
  useAccountCopy,
} from './studentAccountCopy.js';
import type { AccountMessage } from './studentAccountCopy.js';
import { isRouteUuid } from './studentSubjectRoutes.js';

type Schemas = components['schemas'];
type Session = Schemas['SessionInfoDto'];
type Navigate = (url: string) => void;

function AccountFeedback({ message }: { message: AccountMessage | null }) {
  const { text } = useAccountCopy();
  if (!message) return null;
  const status = message === 'revoked' || message === 'codeSent';
  return (
    <p
      className={status ? 'cab-account-hint' : 'cab-form-error'}
      role={status ? 'status' : 'alert'}
    >
      {text(message)}
    </p>
  );
}

function CurrentPassword({ disabled }: { disabled: boolean }) {
  const { text } = useAccountCopy();
  return (
    <label className="cab-form-label">
      <span>{text('currentPassword')}</span>
      <input
        type="password"
        name="currentPassword"
        autoComplete="current-password"
        maxLength={256}
        required
        disabled={disabled}
      />
    </label>
  );
}

export function StudentPassword({
  required,
  hasAccess,
  navigate,
}: {
  required: boolean;
  hasAccess: boolean;
  navigate: Navigate;
}) {
  const { text } = useAccountCopy();
  const hint = useId();
  const [message, setMessage] = useState<AccountMessage | null>(null);
  const { busy, run } = useCabinetAction();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const currentPassword = String(fields.get('currentPassword') ?? '');
    const newPassword = String(fields.get('newPassword') ?? '');
    if (newPassword !== fields.get('confirmPassword')) {
      setMessage('mismatch');
      return;
    }
    if (currentPassword === newPassword) {
      setMessage('samePassword');
      return;
    }
    if (
      !currentPassword ||
      currentPassword.length > 256 ||
      newPassword.length < 8 ||
      newPassword.length > 128 ||
      !/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword)
    ) {
      setMessage('passwordHint');
      return;
    }
    form.reset();
    setMessage(null);
    const result = await run<Schemas['StudentPasswordChangedDto']>('changeStudentPassword', {
      body: { currentPassword, newPassword },
    });
    if (!result) return;
    if (result.ok && result.data?.mustChangePassword === false) {
      leaveSession(
        hasAccess ? (required ? '/student' : '/student/security') : '/student/suspended',
      );
    } else if (result.ok || accountOutcomeUnknown(result.error)) {
      verifySessionOutcome();
    } else {
      setMessage(accountFailure(result.error));
    }
  }
  return (
    <section className="cab-card cab-panel cab-lesson-stack cab-password-form">
      <span className="cab-icon-disc cab-tone-violet">
        <Icon name="health" size={21} />
      </span>
      <h1>{text(required ? 'initialTitle' : 'changePassword')}</h1>
      <p className="cab-account-hint">{text(required ? 'initialHint' : 'passwordHelp')}</p>
      <form className="cab-lesson-stack" onSubmit={(event) => void submit(event)}>
        <CurrentPassword disabled={busy} />
        <label className="cab-form-label">
          <span>{text('newPassword')}</span>
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={busy}
            aria-describedby={hint}
          />
        </label>
        <p id={hint} className="cab-account-hint">
          {text('passwordHint')}
        </p>
        <label className="cab-form-label">
          <span>{text('confirmPassword')}</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            maxLength={128}
            required
            disabled={busy}
          />
        </label>
        <AccountFeedback message={message} />
        <button type="submit" className="cab-button cab-primary" disabled={busy}>
          {text(busy ? 'busy' : 'changePassword')}
        </button>
      </form>
      {!required && (
        <CabinLink
          to={hasAccess ? '/student/security' : '/student/suspended'}
          navigate={navigate}
          className="cab-inline-link"
        >
          {text(hasAccess ? 'backSecurity' : 'cancel')}
        </CabinLink>
      )}
    </section>
  );
}

function StudentEmail({ currentEmail }: { currentEmail: string }) {
  const { text } = useAccountCopy();
  const [address, setAddress] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [message, setMessage] = useState<AccountMessage | null>(null);
  const { busy, run } = useCabinetAction();
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || challenge) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const newEmail = address.trim().toLowerCase();
    if (!newEmail || newEmail === currentEmail.toLowerCase()) {
      setMessage('sameEmail');
      return;
    }
    const currentPassword = String(fields.get('currentPassword') ?? '');
    form.reset();
    setMessage(null);
    const result = await run<Schemas['EmailOtpRequestedDto']>('requestStudentEmailChange', {
      body: { newEmail, currentPassword },
    });
    if (!result) return;
    if (result.ok && typeof result.data?.message === 'string' && result.data.message) {
      setChallenge(newEmail);
      setMessage('codeSent');
    } else if (
      result.ok ||
      (accountFailure(result.error) !== 'emailInactive' && accountOutcomeUnknown(result.error))
    ) {
      setChallenge(newEmail);
      setMessage('deliveryUnknown');
    } else {
      setMessage(accountFailure(result.error));
    }
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || busy) return;
    const form = event.currentTarget;
    const otp = String(new FormData(form).get('otp') ?? '');
    form.reset();
    if (!/^\d{6}$/.test(otp)) {
      setMessage('invalidCode');
      return;
    }
    setMessage(null);
    const result = await run<Schemas['EmailChangedDto']>('confirmStudentEmailChange', {
      body: { newEmail: challenge, otp },
    });
    if (!result) return;
    if (result.ok && result.data?.email === challenge) {
      leaveSession('/student/profile');
    } else if (result.ok || accountOutcomeUnknown(result.error)) {
      verifySessionOutcome();
    } else {
      setMessage(accountFailure(result.error));
    }
  }
  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <h2>{text('emailChange')}</h2>
      <p className="cab-account-hint">{text('emailHelp')}</p>
      {challenge ? (
        <form className="cab-lesson-stack" onSubmit={(event) => void confirm(event)}>
          <strong className="cab-account-address">{challenge}</strong>
          <AccountFeedback message={message} />
          <label className="cab-form-label">
            <span>{text('code')}</span>
            <input
              name="otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              disabled={busy}
            />
          </label>
          <div className="cab-action-grid">
            <button type="submit" className="cab-button cab-primary" disabled={busy}>
              {text(busy ? 'busy' : 'confirmEmail')}
            </button>
            <button
              type="button"
              className="cab-button cab-secondary"
              disabled={busy}
              onClick={() => {
                setChallenge(null);
                setMessage(null);
              }}
            >
              {text('restartEmail')}
            </button>
          </div>
        </form>
      ) : (
        <form className="cab-lesson-stack" onSubmit={(event) => void send(event)}>
          <label className="cab-form-label">
            <span>{text('newEmail')}</span>
            <input
              name="newEmail"
              type="email"
              autoComplete="email"
              value={address}
              maxLength={254}
              required
              disabled={busy}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          <CurrentPassword disabled={busy} />
          <AccountFeedback message={message} />
          <button type="submit" className="cab-button cab-primary" disabled={busy}>
            {text(busy ? 'busy' : 'requestCode')}
          </button>
        </form>
      )}
    </section>
  );
}

function StudentSessions({ zone }: { zone: string }) {
  const { locale, text } = useAccountCopy();
  const sessions = useEndpoint<Session[]>('getStudentSessions');
  const [target, setTarget] = useState<Session | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [message, setMessage] = useState<AccountMessage | null>(null);
  const { busy, run } = useCabinetAction();
  const at = (value: string) => formatDateTime(value, locale, zone) ?? '—';

  async function revoke() {
    if (!target || target.isCurrent || !isRouteUuid(target.sessionId) || busy) return;
    setMessage(null);
    const result = await run<void>('revokeStudentSession', {
      params: { sessionId: target.sessionId },
    });
    if (!result) return;
    returnFocus.current = heading.current;
    setTarget(null);
    if (result.ok) setMessage('revoked');
    else if (accountOutcomeUnknown(result.error)) setMessage('sessionUnknown');
    else setMessage(accountFailure(result.error));
    if (result.ok || !(result.error instanceof CabinetError) || result.error.issue.status !== 401)
      sessions.refresh();
  }

  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <div className="cab-panel-title">
        <h2 ref={heading} tabIndex={-1}>
          {text('sessions')}
        </h2>
        <button
          type="button"
          className="cab-text-button"
          onClick={sessions.refresh}
          disabled={busy || sessions.pending}
        >
          <Icon name="refresh" size={16} /> {text('refresh')}
        </button>
      </div>
      <AccountFeedback message={message} />
      {sessions.pending || !Array.isArray(sessions.data) ? (
        <p className="cab-empty" role={sessions.pending ? 'status' : 'alert'}>
          {text(sessions.pending ? 'busy' : 'unavailable')}
        </p>
      ) : sessions.data.length ? (
        <ul className="cab-session-list">
          {sessions.data.map((session) => (
            <li key={session.sessionId}>
              <div>
                <strong>{text(session.isCurrent ? 'currentSession' : 'otherSession')}</strong>
                <p className="cab-account-hint">{session.userAgent || text('browserUnknown')}</p>
              </div>
              <dl className="cab-profile-facts">
                <div>
                  <dt>{text('created')}</dt>
                  <dd>
                    <time dateTime={session.createdAt}>{at(session.createdAt)}</time>
                  </dd>
                </div>
                <div>
                  <dt>{text('activity')}</dt>
                  <dd>
                    <time dateTime={session.lastActiveAt}>{at(session.lastActiveAt)}</time>
                  </dd>
                </div>
                <div>
                  <dt>{text('address')}</dt>
                  <dd>{session.ipAddress || text('addressUnknown')}</dd>
                </div>
              </dl>
              {!session.isCurrent && isRouteUuid(session.sessionId) && (
                <button
                  className="cab-button cab-secondary"
                  type="button"
                  disabled={busy}
                  onClick={(event) => {
                    returnFocus.current = event.currentTarget;
                    setTarget(session);
                  }}
                >
                  {text('revoke')}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="cab-empty">{text('sessionsEmpty')}</p>
      )}
      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
        }}
        title={text('revoke')}
        description={text('revokeHint')}
        confirmLabel={text('revoke')}
        cancelLabel={text('cancel')}
        onConfirm={() => void revoke()}
        pending={busy}
        pendingDescription={text('busy')}
        returnFocusRef={returnFocus}
        contentProps={{ className: 'cab-dialog' }}
      />
    </section>
  );
}

export function StudentSecurity({
  email,
  zone,
  navigate,
}: {
  email: string;
  zone: string;
  navigate: Navigate;
}) {
  const { text } = useAccountCopy();
  return (
    <div className="cab-lesson-stack">
      <div className="cab-lesson-grid cab-security-grid">
        <section className="cab-card cab-panel cab-lesson-stack">
          <h2>{text('passwordPanel')}</h2>
          <p className="cab-account-hint">{text('passwordHelp')}</p>
          <CabinLink to={studentPasswordPath} navigate={navigate} className="cab-inline-link">
            {text('changePassword')} <Icon name="arrow" size={16} />
          </CabinLink>
        </section>
        <StudentEmail currentEmail={email} />
      </div>
      <StudentSessions zone={zone} />
    </div>
  );
}
