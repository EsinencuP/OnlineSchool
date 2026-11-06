import { useState } from 'react';
import { LanguageSelector, useLocale } from '@online-school/ui';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  createSession,
  authenticatePasskeyStart,
  authenticatePasskeyFinish,
  registerPasskeyStart,
  registerPasskeyFinish,
} from '@online-school/api-contracts';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { useCommand } from '../hooks/use-command.js';
import { clearSession } from '../api/client.js';
import { ErrorBox, FormShell, Input, text } from '../components/ui.js';
import { Icon } from '../components/icon.js';
import { ru } from '../i18n/ru.js';
import type { ApiErrorView } from '../api/error-view.js';
export default function Login() {
  const { t } = useLocale();
  const [mfa, setMfa] = useState(false);
  const [passkeyError, setPasskeyError] = useState<ApiErrorView | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const command = useCommand();
  const navigate = useNavigate();
  const sessionError = (useLocation().state as { sessionError?: ApiErrorView } | null)
    ?.sessionError;
  async function login(data: FormData) {
    clearSession();
    const payload = {
      method: 'password' as const,
      email: text(data, 'email'),
      password: String(data.get('password') ?? ''),
    };
    const result = await command.run({ email: payload.email }, (o) => createSession(payload, o));
    payload.password = '';
    if (result && 'mfa_completed' in result) {
      if (result.mfa_completed || result.manager_password_only)
        navigate('/manager', { replace: true });
      else setMfa(true);
    }
  }
  async function passkey(register: boolean) {
    if (keyBusy || command.busy) return;
    setKeyBusy(true);
    setPasskeyError(null);
    try {
      const { startAuthentication, startRegistration } = await import('@simplewebauthn/browser');
      if (register) {
        const start = await command.run({}, (o) => registerPasskeyStart({}, o));
        if (start) {
          const response = await startRegistration({
            optionsJSON: start.options as unknown as PublicKeyCredentialCreationOptionsJSON,
          });
          const finish = await command.run({ challenge: start.challengeId }, (o) =>
            registerPasskeyFinish(
              {
                challengeId: start.challengeId,
                response: {
                  ...response,
                  response: { ...response.response },
                  clientExtensionResults: { ...response.clientExtensionResults },
                },
              },
              o,
            ),
          );
          if (finish) setMfa(true);
        }
      } else {
        const start = await command.run({}, (o) => authenticatePasskeyStart({}, o));
        if (start) {
          const response = await startAuthentication({
            optionsJSON: start.options as PublicKeyCredentialRequestOptionsJSON,
          });
          const finish = await command.run({ challenge: start.challengeId }, (o) =>
            authenticatePasskeyFinish(
              {
                challengeId: start.challengeId,
                response: {
                  ...response,
                  response: { ...response.response },
                  clientExtensionResults: { ...response.clientExtensionResults },
                },
              },
              o,
            ),
          );
          if (finish) navigate('/manager', { replace: true });
        }
      }
    } catch {
      setPasskeyError({ code: 'PASSKEY_FAILED', status: 0, message: ru.mfaHelp });
    } finally {
      setKeyBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story" aria-label={ru.academy}>
        <div className="login-brand">
          <Icon name="academy" size={38} />
          <span>
            {ru.brandShort}
            <small>{ru.managerPanel}</small>
          </span>
        </div>
        <div className="login-story-copy">
          <p className="eyebrow">{ru.loginEyebrow}</p>
          <h2>{ru.loginTagline}</h2>
          <p>{ru.loginIntro}</p>
          <div className="login-feature">
            <Icon name="users" />
            <span>{ru.myPortfolio}</span>
          </div>
          <div className="login-feature">
            <Icon name="calendar" />
            <span>{ru.workingCalendar}</span>
          </div>
          <div className="login-feature">
            <Icon name="tasks" />
            <span>{ru.myTasks}</span>
          </div>
        </div>
        <p className="login-security">
          <Icon name="shield" size={18} />
          {ru.loginSecurity}
        </p>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="brand-mark" aria-hidden="true">
            <Icon name="academy" size={31} />
          </div>
          <p className="eyebrow">{ru.academy}</p>
          <LanguageSelector />
          <h1>{mfa ? ru.mfa : ru.login}</h1>
          <p className="login-description">{mfa ? ru.firstKeyHelp : ru.loginFormHelp}</p>
          {sessionError && <ErrorBox error={sessionError} />}
          {mfa ? (
            <>
              <p>{ru.mfaHelp}</p>
              <ErrorBox error={command.error ?? passkeyError} />
              <div className="stack">
                <button
                  className="primary"
                  type="button"
                  disabled={keyBusy || command.busy}
                  onClick={() => {
                    void passkey(false);
                  }}
                >
                  {ru.passkey}
                </button>
                <button
                  type="button"
                  disabled={keyBusy || command.busy}
                  onClick={() => {
                    void passkey(true);
                  }}
                >
                  {ru.registerKey}
                </button>
              </div>
            </>
          ) : (
            <FormShell
              busy={command.busy}
              error={command.error}
              submit={login}
              button={t('auth.enter')}
            >
              <Input
                name="email"
                label={t('auth.email')}
                type="email"
                autoComplete="username"
                required
                maxLength={254}
              />
              <Input
                name="password"
                label={t('auth.password')}
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
              />
            </FormShell>
          )}
        </div>
      </section>
    </main>
  );
}
