import assert from 'node:assert/strict';

const profilePath = '/api/v1/student/profile';
const securityPath = '/api/v1/student/security';
const passwordPath = '/student/security/change-password';
const avatarId = '00000000-0000-4000-8000-000000000601';
const currentId = '00000000-0000-4000-8000-000000000602';
const otherId = '00000000-0000-4000-8000-000000000603';
const newAddress = 'new-student@example.test';
const currentPassword = 'fixtureCurrent1';
const nextPassword = 'fixtureNew2026';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==',
  'base64',
);

export function accountFixture({ date, displayName, accountId }) {
  let alias = displayName;
  let email = 'student@example.test';
  let avatarUrl = null;
  let initial = false;
  let otherActive = true;
  const requests = [];
  const profileKeys = [];
  const passwordRequests = [];
  const view = (suspended = false) => ({
    id: accountId,
    userId: accountId,
    displayName: alias,
    email,
    avatarUrl,
    timeZone: 'Europe/Chisinau',
    mustChangePassword: initial,
    hasActiveAccess: !suspended,
    createdAt: date,
  });

  return {
    requests,
    profileKeys,
    passwordRequests,
    view,
    requirePassword() {
      initial = true;
    },
    match: (path) =>
      path === profilePath ||
      path === profilePath + '/avatar' ||
      path.startsWith(securityPath + '/'),
    handle(route, path, suspended) {
      const req = route.request();
      const json = (body, status = 200) => route.fulfill({ status, json: body });
      requests.push(path);
      if (path === profilePath + '/avatar')
        return route.fulfill({ contentType: 'image/png', body: png });
      if (path === securityPath + '/sessions') {
        const sessions = [
          {
            sessionId: currentId,
            isCurrent: true,
            createdAt: date,
            lastActiveAt: date,
            userAgent: 'Chrome · Windows',
            ipAddress: '192.0.2.1',
          },
        ];
        if (otherActive)
          sessions.push({
            sessionId: otherId,
            isCurrent: false,
            createdAt: date,
            lastActiveAt: date,
            userAgent: 'Firefox · Linux',
            ipAddress: '192.0.2.2',
          });
        return json(sessions);
      }
      assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
      if (path === profilePath) {
        assert.equal(req.method(), 'PATCH');
        const key = req.headers()['idempotency-key'];
        assert.match(key, /^[0-9a-f-]{36}$/);
        profileKeys.push(key);
        const body = req.postDataJSON();
        assert.deepEqual(body, { displayName: 'Анна Ученица', avatarFileId: avatarId });
        alias = body.displayName;
        avatarUrl = profilePath + '/avatar?v=' + avatarId;
        return profileKeys.length === 1
          ? json({ code: 'SERVICE_UNAVAILABLE' }, 503)
          : json({ ...view(suspended), avatarFileId: avatarId });
      }
      if (path === securityPath + '/sessions/' + otherId) {
        assert.equal(req.method(), 'DELETE');
        otherActive = false;
        return route.fulfill({ status: 204 });
      }
      if (path === securityPath + '/change-email/request') {
        assert.equal(req.method(), 'POST');
        assert.deepEqual(req.postDataJSON(), { newEmail: newAddress, currentPassword });
        return json({ code: 'EMAIL_DELIVERY_UNAVAILABLE' }, 503);
      }
      if (path === securityPath + '/change-email/confirm') {
        assert.equal(req.method(), 'POST');
        const body = req.postDataJSON();
        assert.equal(body.newEmail, newAddress);
        if (body.otp !== '012345') return json({ code: 'EMAIL_OTP_INVALID' }, 400);
        email = newAddress;
        otherActive = false;
        return json({ email });
      }
      if (path === securityPath + '/change-password') {
        assert.equal(req.method(), 'PATCH');
        const body = req.postDataJSON();
        assert.equal(body.newPassword, nextPassword);
        passwordRequests.push(path);
        if (body.currentPassword !== currentPassword)
          return json({ code: 'CURRENT_PASSWORD_INVALID' }, 401);
        initial = false;
        otherActive = false;
        return json({ mustChangePassword: false });
      }
      return json({ code: 'NOT_FOUND' }, 404);
    },
  };
}

async function passwordFields(page, current = currentPassword, confirmation = nextPassword) {
  await page.getByLabel('Текущий пароль', { exact: true }).fill(current);
  await page.getByLabel('Новый пароль', { exact: true }).fill(nextPassword);
  await page.getByLabel('Повторите новый пароль', { exact: true }).fill(confirmation);
  await page.getByRole('button', { name: 'Сменить пароль', exact: true }).click();
}

export async function verifyStudentAccount({ page, base, account }) {
  await page.goto(base + '/student/profile');
  await page.getByRole('heading', { name: 'Настройки профиля' }).waitFor();
  await page.getByLabel('Имя в кабинете').fill('Анна Ученица');
  await page.getByText('Аватар', { exact: true }).click();
  await page.getByLabel('UUID проверенного файла').fill(avatarId);
  await page.getByRole('button', { name: 'Сохранить профиль' }).click();
  await page.getByText(/Результат сохранения пока неизвестен/).waitFor();
  await page.getByRole('button', { name: 'Повторить сохранение' }).click();
  await page.getByText('Профиль обновлён.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Профиль · Анна Ученица' }).waitFor();
  assert.deepEqual(account.profileKeys, [account.profileKeys[0], account.profileKeys[0]]);
  assert.equal(
    await page.locator('.cab-profile-avatar img').getAttribute('src'),
    profilePath + '/avatar?v=' + avatarId,
  );

  await page.getByRole('link', { name: 'Безопасность', exact: true }).last().click();
  await page.getByText('Текущая сессия', { exact: true }).waitFor();
  const current = page.locator('.cab-session-list li').filter({ hasText: 'Текущая сессия' });
  assert.equal(await current.getByRole('button').count(), 0);
  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: 'Отмена' }).click();
  await confirm.waitFor({ state: 'hidden' });
  assert.ok(!account.requests.includes(securityPath + '/sessions/' + otherId));
  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  await confirm.getByRole('button', { name: 'Завершить сессию' }).click();
  await page.getByText('Сессия завершена.', { exact: true }).waitFor();
  await page.getByText('Текущая сессия', { exact: true }).waitFor();
  assert.equal(await page.getByText('Другая сессия', { exact: true }).count(), 0);

  await page.getByLabel('Новая почта').fill(newAddress);
  await page.getByLabel('Текущий пароль').fill(currentPassword);
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByText(/Доставка кода пока не подтверждена/).waitFor();
  await page.getByLabel('Код из письма').fill('654321');
  await page.getByRole('button', { name: 'Подтвердить почту' }).click();
  await page.getByText(/Код неверен или срок его действия истёк/).waitFor();
  assert.equal(await page.getByLabel('Код из письма').inputValue(), '');
  await page.getByLabel('Код из письма').fill('012345');
  await page.getByRole('button', { name: 'Подтвердить почту' }).click();
  await page.waitForURL(base + '/student/profile');
  await page.getByText(newAddress, { exact: true }).waitFor();

  await page.goto(base + passwordPath);
  await passwordFields(page, currentPassword, 'mismatch1');
  await page.getByText('Новые пароли не совпадают.', { exact: true }).waitFor();
  assert.equal(account.passwordRequests.length, 0);
  await passwordFields(page, 'fixtureWrong1');
  await page.getByText('Текущий пароль неверен.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Текущий пароль', { exact: true }).inputValue(), '');
  await passwordFields(page);
  await page.waitForURL(base + '/student/security');
  await page.getByRole('heading', { name: 'Активные сессии' }).waitFor();
  assert.equal(account.passwordRequests.length, 2);
  assert.ok(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  );
}

export async function verifyLockedStudentPassword({ page, base, account }) {
  account.requirePassword();
  const before = account.requests.length;
  await page.goto(base + '/student/security');
  await page.waitForURL(base + passwordPath);
  await page.getByRole('heading', { name: 'Смените временный пароль' }).waitFor();
  assert.equal(account.requests.slice(before).includes(securityPath + '/sessions'), false);
  await passwordFields(page);
  await page.waitForURL(base + '/student/suspended');
  await page.getByRole('link', { name: 'Сменить пароль' }).click();
  await page.waitForURL(base + passwordPath);
  await page.getByRole('heading', { name: 'Сменить пароль', exact: true }).waitFor();
  await passwordFields(page);
  await page.waitForURL(base + '/student/suspended');
  assert.equal(account.passwordRequests.length, 2);
}
