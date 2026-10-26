import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { err } from '@online-school/shared';
import {
  authenticatePasskeyFinish,
  authenticatePasskeyStart,
  mutation,
  registerPasskeyFinish,
  registerPasskeyStart,
} from './api.js';
import type {
  ClientError,
  PasskeyRegisteredResponse,
  SessionResponse,
  WebAuthnOptions,
} from './api.js';
import type { Result } from '@online-school/shared';

function isCreationOptions(
  value: WebAuthnOptions,
): value is WebAuthnOptions & PublicKeyCredentialCreationOptionsJSON {
  return (
    typeof value.challenge === 'string' &&
    !!value.rp &&
    typeof value.rp === 'object' &&
    'id' in value.rp &&
    typeof value.rp.id === 'string' &&
    !!value.user &&
    typeof value.user === 'object' &&
    'id' in value.user &&
    typeof value.user.id === 'string' &&
    Array.isArray(value.pubKeyCredParams)
  );
}

export async function passkey(
  mode: 'register' | 'authenticate',
): Promise<Result<PasskeyRegisteredResponse | SessionResponse, ClientError>> {
  if (!window.isSecureContext || !window.PublicKeyCredential)
    return err({
      code: 'WEBAUTHN_UNAVAILABLE',
      status: 0,
      message: 'Passkey требует HTTPS и браузер с WebAuthn.',
    });
  try {
    if (mode === 'register') {
      const start = await mutation((options) => registerPasskeyStart({}, options));
      if (!start.ok) return start;
      const options = start.value.options;
      if (!isCreationOptions(options))
        return err({
          code: 'INVALID_WEBAUTHN_OPTIONS',
          status: 0,
          message: 'API вернул неполные параметры регистрации.',
        });
      const response = await startRegistration({ optionsJSON: options });
      return mutation((request) =>
        registerPasskeyFinish(
          {
            challengeId: start.value.challengeId,
            response: {
              ...response,
              response: { ...response.response },
              clientExtensionResults: { ...response.clientExtensionResults },
            },
          },
          request,
        ),
      );
    }
    const start = await mutation((options) => authenticatePasskeyStart({}, options));
    if (!start.ok) return start;
    const options = start.value.options as PublicKeyCredentialRequestOptionsJSON;
    if (!options.challenge || !options.rpId)
      return err({
        code: 'INVALID_WEBAUTHN_OPTIONS',
        status: 0,
        message: 'API вернул неполные параметры входа.',
      });
    const response = await startAuthentication({ optionsJSON: options });
    return mutation((request) =>
      authenticatePasskeyFinish(
        {
          challengeId: start.value.challengeId,
          response: {
            ...response,
            response: { ...response.response },
            clientExtensionResults: { ...response.clientExtensionResults },
          },
        },
        request,
      ),
    );
  } catch (error) {
    const cancelled = error instanceof Error && error.name === 'NotAllowedError';
    return err({
      code: cancelled ? 'PASSKEY_CANCELLED' : 'PASSKEY_FAILED',
      status: 0,
      message: cancelled
        ? 'Запрос passkey отменён или время ожидания истекло. Можно повторить.'
        : 'Не удалось использовать passkey. Проверьте домен и выбранный ключ.',
    });
  }
}
