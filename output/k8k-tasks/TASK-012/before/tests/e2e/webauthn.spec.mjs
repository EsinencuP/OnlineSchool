import { expect, test } from '@playwright/test';
const origin = process.env.FND_WORKING_ORIGIN;
const credentials = process.env.FND_E2E_CREDENTIALS
  ? JSON.parse(process.env.FND_E2E_CREDENTIALS)
  : null;
test.beforeAll(() => {
  if (!origin || new URL(origin).protocol !== 'https:' || !credentials)
    throw new Error(
      'Explicit working HTTPS origin and ordinary disposable staff accounts required; never use the owner account',
    );
});
async function passwordLogin(page, account) {
  await page.goto(origin);
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Пароль', { exact: true }).fill(account.password);
  const login = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/auth/session') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Войти по паролю', exact: true }).click();
  const response = await login;
  expect(response.status()).toBe(200);
  expect((await response.json()).mfa_completed).toBe(false);
}
const protectedStatus = (page) =>
  page.evaluate(async () => {
    const response = await fetch('/api/v1/qa/components', { cache: 'no-store' });
    return response.status;
  });
test('staff login + Chromium WebAuthn registration/authentication + protected route', async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  try {
    await passwordLogin(page, credentials.enroll);
    expect(await protectedStatus(page)).toBe(403);
    const registration = page.waitForResponse((r) => r.url().endsWith('/webauthn/register/finish'));
    await page.getByRole('button', { name: 'Зарегистрировать passkey', exact: true }).click();
    expect((await registration).status()).toBe(200);
    // Registration alone deliberately does not advance the MFA stage.
    expect(await protectedStatus(page)).toBe(403);
    const authentication = page.waitForResponse((r) =>
      r.url().endsWith('/webauthn/authenticate/finish'),
    );
    await page.getByRole('button', { name: 'Войти с passkey', exact: true }).click();
    const response = await authentication;
    expect(response.status()).toBe(200);
    expect((await response.json()).mfa_completed).toBe(true);
    expect(await protectedStatus(page)).toBe(200);
    const keys = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    expect(keys.credentials).toHaveLength(1);
  } finally {
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
  }
});
test('staff password login without WebAuthn stays in the limited stage', async ({ page }) => {
  await passwordLogin(page, credentials.limited);
  expect(await protectedStatus(page)).toBe(403);
  const session = await page.evaluate(async () => (await fetch('/api/v1/auth/session')).json());
  expect(session.mfa_completed).toBe(false);
  await expect(page.getByRole('button', { name: 'Подтвердить платёж', exact: true })).toHaveCount(
    0,
  );
});
