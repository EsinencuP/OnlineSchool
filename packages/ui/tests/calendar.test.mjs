import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Calendar, DatePicker, calendarDate } from '../dist/index.js';

test('plain date validation rejects rollover and time-bearing values', () => {
  assert.equal(calendarDate('2028-02-29'), '2028-02-29');
  for (const bad of ['2026-02-29', '2026-13-01', '2026-10-25T00:00:00Z', '0000-01-01'])
    assert.equal(calendarDate(bad), null);
  const picker = renderToStaticMarkup(
    h(DatePicker, {
      value: '2026-10-25',
      label: 'Validity',
      onValueChange: () => assert.fail('render changes date'),
    }),
  );
  assert.match(picker, /type="date"[^>]*value="2026-10-25"/);
});

test('month renders supplied dates across DST without inventing coverage or events', () => {
  const html = renderToStaticMarkup(
    h(Calendar, {
      label: 'October',
      view: 'month',
      timeZone: 'Europe/Chisinau',
      days: ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'],
      horizon: { from: '2026-10-24T21:00:00Z', to: '2026-10-25T22:00:00Z' },
      events: [
        {
          id: 'dst',
          revision: null,
          startsAt: '2026-10-25T01:30:00Z',
          endsAt: '2026-10-25T01:50:00Z',
          title: 'Supplied',
          state: 'busy',
        },
      ],
    }),
  );
  assert.equal((html.match(/class="k8k-calendar-day"/g) ?? []).length, 4);
  assert.equal((html.match(/data-event-id=/g) ?? []).length, 1);
  assert.match(html, /data-date="2026-10-25" data-weekday="7"/);
  assert.match(html, /datetime="2026-10-25T01:30:00Z">03:30[^<]*\+2/i);
  assert.equal((html.match(/Дата вне загруженного диапазона/g) ?? []).length, 3);
});

test('calendar preserves UTC instants and distinguishes two repeated local times', () => {
  const html = renderToStaticMarkup(
    h(Calendar, {
      label: 'Fixture',
      view: 'day',
      days: ['2026-10-25'],
      timeZone: 'Europe/Chisinau',
      horizon: { from: '2026-10-24T21:00:00Z', to: '2026-10-25T22:00:00Z' },
      events: [
        {
          id: 'a',
          revision: 2,
          startsAt: '2026-10-25T00:30:00Z',
          endsAt: '2026-10-25T00:50:00Z',
          title: 'Protected',
          state: 'protected',
        },
        {
          id: 'b',
          revision: 3,
          startsAt: '2026-10-25T01:30:00Z',
          endsAt: '2026-10-25T01:50:00Z',
          title: 'Renewal',
          state: 'pending-renewal',
        },
      ],
    }),
  );
  assert.match(html, /datetime="2026-10-25T00:30:00Z">03:30[^<]*\+3/i);
  assert.match(html, /datetime="2026-10-25T01:30:00Z">03:30[^<]*\+2/i);
  assert.match(html, /data-event-id="b" data-revision="3" data-event-state="pending-renewal"/);
});

test('partial or missing horizon never turns an interval into free time', () => {
  const props = {
    label: 'Fixture',
    view: 'list',
    days: ['2026-10-25'],
    timeZone: 'Europe/Chisinau',
    events: [
      {
        id: 'partial',
        revision: null,
        startsAt: '2026-10-25T12:00:00Z',
        endsAt: '2026-10-25T15:00:00Z',
        title: 'Partial',
        state: 'free',
      },
      {
        id: 'invalid',
        revision: null,
        startsAt: '2026-10-25T12:00',
        endsAt: '2026-10-25T13:00:00Z',
        title: 'Floating',
        state: 'free',
      },
    ],
  };
  const html = renderToStaticMarkup(
    h(Calendar, {
      ...props,
      horizon: { from: '2026-10-25T11:00:00Z', to: '2026-10-25T14:00:00Z' },
    }),
  );
  assert.match(html, /data-event-id="partial" data-event-state="unknown"/);
  assert.doesNotMatch(html, /data-event-state="free"|data-event-id="invalid"/);
  const missing = renderToStaticMarkup(h(Calendar, { ...props, horizon: null }));
  assert.match(missing, /вне загруженного диапазона/);
  assert.doesNotMatch(missing, /data-event-id=/);
});
