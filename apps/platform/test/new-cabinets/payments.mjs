import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export function paymentChecks(paymentId, date) {
  const studentId = '00000000-0000-4000-8000-000000000140';
  const subscriptionId = '00000000-0000-4000-8000-000000000141';
  const recipientId = '00000000-0000-4000-8000-000000000142';
  const distributionId = '00000000-0000-4000-8000-000000000143';
  const student = { studentId, fullName: 'Вера Дубова', maskedPhone: '+373 ** *** 01' };
  const managerStudent = '/api/v1/manager/students/' + studentId;
  const receiptPath = '/api/v1/manager/payments/' + paymentId;
  const directorPath = '/api/v1/platform/payments/' + paymentId + '/confirm-eligibility';
  const decisionPath = '/director/decisions/PAYMENT/' + paymentId;
  const managerCalls = [];
  const directorCalls = [];
  let payment;
  let allocation;
  let managerMaySubmit = false;
  let directorMayConfirm = false;

  function command(req) {
    assert.equal(req.method(), 'POST');
    assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
    assert.match(req.headers()['idempotency-key'], /^[a-f0-9-]{36}$/);
    return { key: req.headers()['idempotency-key'], body: req.postDataJSON() };
  }

  async function attach(page, role) {
    if (role !== 'MANAGER' && role !== 'DIRECTOR') return;
    await page.route(/\/api\/v1\/(?:manager|director|platform)\//, (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname;
      const json = (value, status = 200) => route.fulfill({ status, json: value });
      if (role === 'MANAGER') {
        if (path === '/api/v1/manager/students') {
          if (url.searchParams.has('search'))
            assert.equal(url.searchParams.get('search'), 'Дубова');
          return json({ items: [student], nextCursor: null });
        }
        if (path === managerStudent) return json(student);
        if (path === managerStudent + '/payments') {
          if (req.method() === 'POST') {
            const { body } = command(req);
            assert.deepEqual(body, {
              amount: '1200.1234',
              currency: 'MDL',
              method: 'BANK_TRANSFER',
              purpose: 'RENEWAL',
              receivedAt: '2026-11-16T08:00:00Z',
              externalRef: 'SYNTHETIC-REF-48',
            });
            payment = {
              ...body,
              id: paymentId,
              studentId,
              status: 'PENDING',
              ledgerPublicationId: null,
              rejectionReason: null,
              createdAt: date,
            };
            return json(payment, 201);
          }
          return json({
            items: payment ? [payment] : [],
            page: 1,
            pageSize: 20,
            total: Number(!!payment),
          });
        }
        if (path.endsWith('/distributions') && req.method() === 'GET') {
          const items = allocation && path.includes(recipientId) ? [allocation] : [];
          return json({ items, page: 1, pageSize: 20, total: items.length });
        }
        if (path === receiptPath) {
          return payment ? json(payment) : json({ code: 'PAYMENT_NOT_FOUND' }, 404);
        }
        if (path === receiptPath + '/approval-eligibility') {
          return json({
            action: 'payment.request-approval',
            objectId: managerMaySubmit ? paymentId : null,
            allowed: managerMaySubmit && payment?.status === 'PENDING',
            reason: managerMaySubmit ? null : 'UNAVAILABLE',
            asOf: date,
          });
        }
        if (path === receiptPath + '/confirm') {
          assert.ok(managerMaySubmit);
          managerCalls.push(command(req));
          assert.equal(payment.status, 'PENDING');
          payment.status = 'AWAITING_APPROVAL';
          return json({ code: 'SERVICE_UNAVAILABLE' }, 503);
        }
        if (path === receiptPath + '/distributions' && req.method() === 'POST') {
          assert.equal(payment.status, 'CONFIRMED');
          const { body } = command(req);
          assert.deepEqual(body, { amount: '600.0001', subscriptionId });
          allocation = {
            ...body,
            id: distributionId,
            paymentId,
            status: 'AWAITING_APPROVAL',
            studentId: recipientId,
            currency: 'MDL',
            consumed: false,
            ledgerPublicationId: null,
          };
          return json(allocation, 201);
        }
        if (path === '/api/v1/manager/options') {
          return json({
            students: [
              { id: studentId, label: student.fullName },
              { id: recipientId, label: 'Михаил Дубов' },
            ],
            financialSubscriptions:
              url.searchParams.get('studentId') === recipientId
                ? [
                    {
                      id: subscriptionId,
                      label: 'Алгебра, 8 уроков',
                      currency: 'MDL',
                      startsAt: date,
                    },
                  ]
                : [],
            plans: [],
            enrollments: [],
            teachers: [],
            subjects: [],
          });
        }
      } else {
        if (path === directorPath) {
          const confirmed = payment?.status === 'CONFIRMED';
          return json({
            action: 'payment.confirm',
            objectId: paymentId,
            allowed: directorMayConfirm && !confirmed,
            reason: confirmed
              ? 'PAYMENT_ALREADY_CONFIRMED'
              : directorMayConfirm
                ? null
                : 'CLOSED_PERIOD',
            asOf: date,
          });
        }
        if (path === '/api/v1' + decisionPath) {
          assert.equal(payment.status, 'AWAITING_APPROVAL');
          return json({
            id: paymentId,
            kind: 'PAYMENT',
            amount: payment.amount,
            currency: payment.currency,
            studentName: student.fullName,
            requestedBy: 'Тамара Светлова',
            requestedAt: date,
            ready: true,
            facts: { receivedAt: payment.receivedAt, externalReference: payment.externalRef },
            commands: [
              {
                operationId: 'confirmPayment',
                method: 'POST',
                path: '/api/v1/payments/{id}/confirm',
                effect: 'Подтвердить поступление',
              },
            ],
          });
        }
        if (path === '/api/v1/director/payments/' + paymentId + '/confirm') {
          directorCalls.push(command(req));
          if (directorCalls.length === 1) return json({ code: 'COMMAND_IN_PROGRESS' }, 409);
          assert.ok(directorMayConfirm);
          payment.status = 'CONFIRMED';
          payment.ledgerPublicationId = distributionId;
          return json({
            id: paymentId,
            kind: 'PAYMENT',
            outcome: 'CONFIRMED',
            decidedAt: date,
            result: {},
          });
        }
      }
      return route.fallback();
    });
  }

  async function manager(page, base, output) {
    await page.goto(base + '/manager/payments');
    await page.getByRole('searchbox', { name: 'Имя ученика' }).fill('Дубова');
    await page.getByRole('button', { name: 'Найти' }).click();
    await page.getByRole('link', { name: student.fullName }).click();
    await page.waitForURL(base + '/manager/students/' + studentId + '/payments');
    await page.getByRole('button', { name: 'Зарегистрировать поступление' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('[name=amount]').fill('1200,1234');
    await dialog.locator('[name=method]').selectOption('BANK_TRANSFER');
    await dialog.locator('[name=purpose]').selectOption('RENEWAL');
    await dialog.locator('[name=receivedAt]').fill('2026-11-16T10:00');
    await dialog.locator('[name=externalRef]').fill('SYNTHETIC-REF-48');
    await dialog.getByRole('button', { name: 'Зарегистрировать поступление' }).click();
    await dialog.getByText('Поступление зарегистрировано.').waitFor();
    await dialog.getByRole('link', { name: 'Открыть поступление' }).click();
    await page.getByText('Сервер пока не разрешает это действие.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Передать на согласование' }).count(), 0);
    managerMaySubmit = true;
    await page.getByRole('button', { name: 'Проверить состояние' }).click();
    await page.getByRole('button', { name: 'Передать на согласование' }).click();
    await dialog.getByRole('button', { name: 'Передать на согласование' }).click();
    await dialog.getByText(/Результат операции пока неизвестен/).waitFor();
    await dialog.getByRole('button', { name: 'Проверить состояние' }).click();
    await dialog.getByText('Поступление передано руководителю.').waitFor();
    assert.equal(managerCalls.length, 1);
    assert.deepEqual(managerCalls[0].body, {});
    assert.equal(payment.ledgerPublicationId, null);
    await dialog.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
    await page.getByText('На согласовании', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Подтвердить поступление' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Отклонить поступление' }).count(), 0);
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
      true,
    );
    if (output)
      await page.screenshot({
        path: resolve(output, 'manager-receipt-mobile.png'),
        animations: 'disabled',
      });
  }

  async function director(page, base, output) {
    await page.getByRole('link', { name: /Подтверждение поступления/ }).click();
    await page.waitForURL(base + decisionPath);
    await page.getByText(/1\s*200,1234/).waitFor();
    await page.getByText('Нет открытого расчётного периода для подтверждения.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Подтвердить поступление' }).count(), 0);
    directorMayConfirm = true;
    await page.getByRole('button', { name: 'Проверить состояние' }).click();
    if (output) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.getByRole('button', { name: 'Подтвердить поступление' }).waitFor();
      await page.screenshot({
        path: resolve(output, 'director-receipt.png'),
        animations: 'disabled',
      });
    }
    await page.getByRole('button', { name: 'Подтвердить поступление' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Подтвердить поступление' }).click();
    await dialog.getByText(/Результат операции пока неизвестен/).waitFor();
    assert.equal(
      await dialog.getByRole('button', { name: 'Повторить исходную отправку' }).count(),
      0,
    );
    await dialog.getByRole('button', { name: 'Проверить состояние' }).click();
    await dialog.getByRole('button', { name: 'Повторить исходную отправку' }).click();
    await dialog.getByText('Поступление подтверждено.').waitFor();
    assert.equal(directorCalls.length, 2);
    assert.deepEqual(directorCalls[0], directorCalls[1]);
  }

  async function allocate(page, base) {
    await page.goto(base + '/manager/payments/' + paymentId);
    await page.getByRole('button', { name: 'Предложить распределение' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('[name=recipient]').selectOption(recipientId);
    await dialog.locator('[name=subscriptionId]').selectOption(subscriptionId);
    await dialog.locator('[name=amount]').fill('600.0001');
    await dialog.getByRole('button', { name: 'Предложить распределение' }).click();
    await dialog.getByText('Распределение ожидает согласования.').waitFor();
    assert.equal(allocation.ledgerPublicationId, null);
    assert.equal(allocation.consumed, false);
  }

  return { attach, manager, director, allocate };
}
