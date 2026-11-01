import { useState } from 'react';
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
import { ru } from '../i18n/ru.js';
import type { ApiErrorView } from '../api/error-view.js';
export default function Login() {
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
      if (result.mfa_completed) navigate('/manager', { replace: true });
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
    <main className="auth-shell">
      <div className="brand-mark" aria-hidden="true">
        A
      </div>
      <p className="eyebrow">{ru.academy}</p>
      <h1>{mfa ? ru.mfa : ru.login}</h1>
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
        <FormShell busy={command.busy} error={command.error} submit={login} button={ru.enter}>
          <Input
            name="email"
            label={ru.email}
            type="email"
            autoComplete="username"
            required
            maxLength={254}
          />
          <Input
            name="password"
            label={ru.password}
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
        </FormShell>
      )}
    </main>
  );
}
