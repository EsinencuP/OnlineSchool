import { createHash, randomBytes } from 'node:crypto';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { GOOGLE_MEET_CREATED_SCOPE, isGoogleAccessToken } from './google-meet-client.js';

const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const tokenScopes = ['openid', GOOGLE_MEET_CREATED_SCOPE] as const;
const proofPattern = /^[A-Za-z0-9_-]{43}$/;

type Config = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type OAuthError = {
  code:
    | 'OAUTH_NOT_CONFIGURED'
    | 'OAUTH_INVALID_PROOF'
    | 'OAUTH_AUTHORIZATION_REQUIRED'
    | 'OAUTH_SCOPE_MISMATCH'
    | 'OAUTH_PROVIDER_UNAVAILABLE'
    | 'OAUTH_PROVIDER_RESPONSE_INVALID'
    | 'OAUTH_PROVIDER_REJECTED';
};

type Access = { accessToken: string; refreshToken: string | null; expiresInSeconds: number };
type Connection = Access & { subject: string; refreshToken: string };

export function readMeetOAuthConfig(env: NodeJS.ProcessEnv): Result<Config, OAuthError> {
  const clientId = env.GOOGLE_MEET_CLIENT_ID ?? '';
  const clientSecret = env.GOOGLE_MEET_CLIENT_SECRET ?? '';
  const redirectUri = env.GOOGLE_MEET_REDIRECT_URI ?? '';
  const uri = URL.canParse(redirectUri) ? new URL(redirectUri) : null;
  if (
    !/^[A-Za-z0-9_-]{6,200}\.apps\.googleusercontent\.com$/.test(clientId) ||
    !/^[A-Za-z0-9_-]{8,200}$/.test(clientSecret) ||
    !uri ||
    uri.protocol !== 'https:' ||
    uri.username ||
    uri.password ||
    uri.search ||
    uri.hash
  )
    return err({ code: 'OAUTH_NOT_CONFIGURED' });
  return ok({ clientId, clientSecret, redirectUri });
}

export const isMeetOAuthProof = (value: string) => proofPattern.test(value);
export const meetOAuthStateHash = (state: string) =>
  createHash('sha256').update(state).digest('hex');

export class GoogleMeetOAuthClient {
  constructor(
    private readonly config: Config,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  authorization() {
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: tokenScopes.join(' '),
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return { authorizationUrl: url.toString(), stateHash: meetOAuthStateHash(state), verifier };
  }

  async exchange(code: string, verifier: string): Promise<Result<Connection, OAuthError>> {
    if (!isMeetOAuthProof(verifier) || !/^[!-~]{8,2048}$/.test(code))
      return err({ code: 'OAUTH_INVALID_PROOF' });
    const tokens = await this.tokens(
      {
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: this.config.redirectUri,
      },
      true,
    );
    if (!tokens.ok) return tokens;
    if (!tokens.value.refreshToken) return err({ code: 'OAUTH_AUTHORIZATION_REQUIRED' });
    const subject = await this.subject(tokens.value.accessToken);
    if (!subject.ok) return subject;
    return ok({ ...tokens.value, refreshToken: tokens.value.refreshToken, subject: subject.value });
  }

  async refresh(refreshToken: string): Promise<Result<Access, OAuthError>> {
    if (!isGoogleAccessToken(refreshToken)) return err({ code: 'OAUTH_AUTHORIZATION_REQUIRED' });
    return this.tokens({ grant_type: 'refresh_token', refresh_token: refreshToken }, false);
  }

  async revoke(refreshToken: string): Promise<Result<void, OAuthError>> {
    if (!isGoogleAccessToken(refreshToken)) return err({ code: 'OAUTH_AUTHORIZATION_REQUIRED' });
    const response = await this.send('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      body: new URLSearchParams({ token: refreshToken }),
    });
    if (!response.ok) return response;
    if (!response.value.ok) {
      const details = (await response.value.json().catch(() => null)) as { error?: unknown } | null;
      return err({
        code:
          details?.error === 'invalid_token'
            ? 'OAUTH_AUTHORIZATION_REQUIRED'
            : 'OAUTH_PROVIDER_REJECTED',
      });
    }
    await response.value.body?.cancel().catch(() => {});
    return ok(undefined);
  }

  private async tokens(
    fields: Record<string, string>,
    requireScopes: boolean,
  ): Promise<Result<Access, OAuthError>> {
    const response = await this.send(tokenEndpoint, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        ...fields,
      }),
    });
    if (!response.ok) return response;
    const body = (await response.value.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.value.ok)
      return err({
        code:
          body?.error === 'invalid_grant'
            ? 'OAUTH_AUTHORIZATION_REQUIRED'
            : 'OAUTH_PROVIDER_REJECTED',
      });
    if (
      !body ||
      !isGoogleAccessToken(body.access_token) ||
      typeof body.token_type !== 'string' ||
      body.token_type.toLowerCase() !== 'bearer' ||
      typeof body.expires_in !== 'number' ||
      !Number.isSafeInteger(body.expires_in) ||
      body.expires_in <= 0 ||
      (body.refresh_token !== undefined && !isGoogleAccessToken(body.refresh_token))
    )
      return err({ code: 'OAUTH_PROVIDER_RESPONSE_INVALID' });
    if (requireScopes || body.scope !== undefined) {
      const scopes = new Set(
        typeof body.scope === 'string' ? body.scope.split(/\s+/).filter(Boolean) : [],
      );
      if (scopes.size !== tokenScopes.length || !tokenScopes.every((scope) => scopes.has(scope)))
        return err({ code: 'OAUTH_SCOPE_MISMATCH' });
    }
    return ok({
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresInSeconds: body.expires_in,
    });
  }

  private async subject(accessToken: string): Promise<Result<string, OAuthError>> {
    const response = await this.send('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return response;
    if (!response.value.ok) {
      await response.value.body?.cancel().catch(() => {});
      return err({
        code:
          response.value.status === 401 || response.value.status === 403
            ? 'OAUTH_AUTHORIZATION_REQUIRED'
            : 'OAUTH_PROVIDER_REJECTED',
      });
    }
    const body = (await response.value.json().catch(() => null)) as { sub?: unknown } | null;
    return typeof body?.sub === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(body.sub)
      ? ok(body.sub)
      : err({ code: 'OAUTH_PROVIDER_RESPONSE_INVALID' });
  }

  private async send(url: string, init: RequestInit): Promise<Result<Response, OAuthError>> {
    try {
      const response = await this.fetcher(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel().catch(() => {});
        return err({ code: 'OAUTH_PROVIDER_UNAVAILABLE' });
      }
      return ok(response);
    } catch {
      return err({ code: 'OAUTH_PROVIDER_UNAVAILABLE' });
    }
  }
}
