import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webAuthnSettings } from '../dist/modules/identity/webauthn.config.js';

test('WebAuthn config pins one exact HTTPS QA hostname, including a permanent Vercel alias', () => {
  assert.equal(
    webAuthnSettings({
      WEBAUTHN_RP_ID: 'qa.school.test',
      WEBAUTHN_ALLOWED_ORIGIN: 'https://qa.school.test',
    }).ok,
    true,
  );
  for (const [rp, origin] of [
    ['qa.school.test', 'http://qa.school.test'],
    ['qa.school.test', 'https://qa.school.test/'],
    ['qa.school.test', 'https://qa.school.test:444'],
    ['qa.school.test', 'https://other.school.test'],
    ['vercel.app', 'https://vercel.app'],
    ['school-qa.vercel.app', 'https://school-qa-preview-123.vercel.app'],
    ['*.school.test', 'https://qa.school.test'],
    ['qa.school.test', 'https://user:password@qa.school.test'],
  ])
    assert.equal(
      webAuthnSettings({ WEBAUTHN_RP_ID: rp, WEBAUTHN_ALLOWED_ORIGIN: origin }).ok,
      false,
    );
  assert.equal(webAuthnSettings({}).ok, false);
  assert.equal(
    webAuthnSettings({
      WEBAUTHN_RP_ID: 'school-qa.vercel.app',
      WEBAUTHN_ALLOWED_ORIGIN: 'https://school-qa.vercel.app',
    }).ok,
    true,
  );
});
