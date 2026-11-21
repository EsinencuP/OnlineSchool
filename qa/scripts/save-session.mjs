#!/usr/bin/env node
// Owner-assisted login capture: node qa/scripts/save-session.mjs <student|teacher|manager|director>
// Opens a VISIBLE, fresh browser context at <origin>/account. The owner types the login/password
// themselves. Once the page leaves the login form the storage state is saved to
// qa/private/<role>.storage.json (git-ignored), refreshed while the window stays open, and the script
// exits when the owner closes the window. Credentials are never read, logged or passed through this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const role = process.argv[2];
if (!['student', 'teacher', 'manager', 'director'].includes(role)) {
  console.error('usage: save-session.mjs <student|teacher|manager|director>');
  process.exit(2);
}
const build = JSON.parse(fs.readFileSync(path.join(root, 'qa/fixtures/build.json'), 'utf8'));
const origin = new URL(build.origin).origin;
const out = path.join(root, 'qa/private', `${role}.storage.json`);
fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext(); // fresh, isolated: no shared cookies with other roles
const page = await context.newPage();
await page.goto(`${origin}/account`);
console.log(`[${role}] browser opened at ${origin}/account — log in yourself, then close the window.`);

let saved = false;
const initialCookies = (await context.cookies()).length;
const tick = setInterval(async () => {
  try {
    const p = new URL(page.url()).pathname.replace(/\/+$/, '');
    const authed = (await context.cookies()).length > initialCookies;
    if (authed || (p !== '/account' && p !== '/login' && p !== '')) {
      const tmp = `${out}.tmp`; // owner-only file, atomic replace
      fs.writeFileSync(tmp, JSON.stringify(await context.storageState()), { mode: 0o600 });
      fs.renameSync(tmp, out);
      if (!saved) console.log(`[${role}] logged in, session saved (${p}).`);
      saved = true;
    }
  } catch { /* page closing */ }
}, 2000);
browser.on('disconnected', () => {
  clearInterval(tick);
  console.log(saved ? `[${role}] done: qa/private/${role}.storage.json` : `[${role}] window closed before login — nothing saved.`);
  process.exit(saved ? 0 : 1);
});
