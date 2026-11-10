import test from 'node:test';
import assert from 'node:assert/strict';
import { conflictsWithBusy } from '../functions/lib/availability.ts';
import { getCalendarEvents } from '../functions/lib/apple-caldav.ts';

const hour = 3600000;
const event = { start: '2027-01-11T10:00:00Z', end: '2027-01-11T11:00:00Z' };
const at = (hours, minutes = 0) => Date.parse(`2027-01-11T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);

test('one hour is required before and after each busy event', () => {
  assert.equal(conflictsWithBusy(at(11), at(12), [event]), true);
  assert.equal(conflictsWithBusy(at(11, 59), at(12, 59), [event]), true);
  assert.equal(conflictsWithBusy(at(12), at(13), [event]), false);
  assert.equal(conflictsWithBusy(at(8), at(9), [event]), false);
  assert.equal(conflictsWithBusy(at(8, 1), at(9, 1), [event]), true);
  assert.equal(conflictsWithBusy(at(9), at(10), [event]), true);
});

test('calendar reads handle all-day and London-time recurring events', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (init.method === 'REPORT') return new Response('<d:multistatus><c:calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:dayoff\r\nDTSTART;VALUE=DATE:20270712\r\nDTEND;VALUE=DATE:20270713\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:weekly\r\nDTSTART;TZID=Europe/London:20270705T100000\r\nDTEND;TZID=Europe/London:20270705T110000\r\nRRULE:FREQ=WEEKLY\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data></d:multistatus>', { status: 207 });
    if (String(url).endsWith('/principal/')) return new Response('<d:calendar-home-set><d:href>/home/</d:href></d:calendar-home-set>', { status: 207 });
    if (String(url).endsWith('/home/')) return new Response('<d:response><d:href>/home/work/</d:href><d:displayname>Work</d:displayname><d:resourcetype><c:calendar/></d:resourcetype></d:response>', { status: 207 });
    return new Response('<d:current-user-principal><d:href>/principal/</d:href></d:current-user-principal>', { status: 207 });
  };
  try {
    const start = Date.parse('2027-07-12T00:00:00Z');
    const events = await getCalendarEvents({ caldavUrl: 'https://caldav.icloud.com/', username: 'test', password: 'test' }, { start: start - hour, end: start + 48 * hour });
    assert.ok(events.some((e) => e.start === '2027-07-11T23:00:00.000Z' && e.end === '2027-07-12T23:00:00.000Z'));
    assert.ok(events.some((e) => e.start === '2027-07-12T09:00:00.000Z' && e.end === '2027-07-12T10:00:00.000Z'));
  } finally {
    globalThis.fetch = oldFetch;
  }
});
