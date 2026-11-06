import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/book.ts';
import { onRequest as approve } from '../functions/api/admin/approve.ts';
import { onRequest as availability } from '../functions/api/availability.ts';
import { BUSINESS } from '../lib/config.js';

const payload = {
  postcode: 'CV8 1AB', size: 'M', service: 'EFD', date: '2027-07-12', time: '10:00',
  name: 'Jamie <Lee>', phone: '07700900123', email: 'jamie@example.com',
  address: '12 Castle Road', vehicle: 'Golf', notes: 'Gate code',
};

async function submit({ calendarFailure = false, missingEmailKey = false, emailFailure = false, date = payload.date } = {}) {
  const calls = [];
  const inserts = [];
  const env = {
    APPLE_CALDAV_URL: 'https://caldav.icloud.com/', APPLE_USERNAME: 'test',
    APPLE_APP_SPECIFIC_PASSWORD: 'test', APPLE_CALENDAR_NAME: 'Work',
    RESEND_API_KEY: missingEmailKey ? '' : 'test-key',
    DB: { prepare: (sql) => ({ bind: (...values) => ({ run: async () => { inserts.push({ sql, values }); } }) }) },
  };
  const previousFetch = globalThis.fetch;
  const previousError = console.error;
  console.error = () => {};
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), ...init });
    if (String(url).startsWith('https://api.postcodes.io/')) {
      return Response.json({ result: { latitude: BUSINESS.origin.lat, longitude: BUSINESS.origin.lng } });
    }
    if (String(url) === 'https://api.resend.com/emails') return emailFailure ? new Response('unavailable', { status: 503 }) : Response.json({ id: 'email-id' });
    if (calendarFailure) return new Response('unavailable', { status: 503 });
    if (init.method === 'PUT') return new Response(null, { status: 201 });
    if (String(url).endsWith('/principal/')) return new Response('<d:calendar-home-set><d:href>/home/</d:href></d:calendar-home-set>', { status: 207 });
    if (String(url).endsWith('/home/')) return new Response('<d:response><d:href>/home/work/</d:href><d:displayname>Work</d:displayname><d:resourcetype><c:calendar/></d:resourcetype></d:response>', { status: 207 });
    return new Response('<d:current-user-principal><d:href>/principal/</d:href></d:current-user-principal>', { status: 207 });
  };
  try {
    const request = new Request('https://example.com/api/book', { method: 'POST', body: JSON.stringify({ ...payload, date }) });
    const response = await onRequest({ request, env });
    return { response, body: await response.json(), calls, inserts };
  } finally {
    globalThis.fetch = previousFetch;
    console.error = previousError;
  }
}

test('new request is stored, written to the Work calendar and emailed to the owner', async () => {
  const { response, body, calls, inserts } = await submit();
  assert.equal(response.status, 200);
  assert.equal(body.contactRequired, false);
  assert.equal(inserts.length, 1);
  assert.match(inserts[0].sql, /'requested'/);
  const event = calls.find((call) => call.method === 'PUT');
  assert.match(event.url, /\/home\/work\/.*\.ics$/);
  assert.match(event.body, /DTSTART:20270712T090000Z/);
  assert.match(event.body, /DTEND:20270712T123000Z/);
  assert.match(event.body, /Booking request/);
  const mail = JSON.parse(calls.find((call) => call.url === 'https://api.resend.com/emails').body);
  assert.deepEqual(mail.to, ['jake@auto-shine.co.uk']);
  assert.equal(mail.reply_to, 'jamie@example.com');
  assert.match(mail.html, /Jamie &lt;Lee&gt;/);
  assert.equal(calls.filter((call) => call.url === 'https://api.resend.com/emails').length, 1);
});

test('calendar failure still emails the owner and asks the customer to make contact', async () => {
  const { body, calls, inserts } = await submit({ calendarFailure: true });
  assert.equal(body.success, true);
  assert.equal(body.contactRequired, true);
  assert.equal(inserts.length, 1);
  const mail = JSON.parse(calls.find((call) => call.url === 'https://api.resend.com/emails').body);
  assert.match(mail.html, /Calendar update failed/);
});

test('missing email configuration still creates the event and asks the customer to make contact', async () => {
  const { body, calls, inserts } = await submit({ missingEmailKey: true });
  assert.equal(body.success, true);
  assert.equal(body.contactRequired, true);
  assert.equal(inserts.length, 1);
  assert.ok(calls.some((call) => call.method === 'PUT'));
  assert.ok(!calls.some((call) => call.url === 'https://api.resend.com/emails'));
});

test('email provider failure leaves the booking and calendar event intact', async () => {
  const { body, calls, inserts } = await submit({ emailFailure: true });
  assert.equal(body.success, true);
  assert.equal(body.contactRequired, true);
  assert.equal(inserts.length, 1);
  assert.equal(calls.filter((call) => call.method === 'PUT').length, 1);
});

test('winter bookings use GMT rather than summer time', async () => {
  const { calls } = await submit({ date: '2027-01-11' });
  assert.match(calls.find((call) => call.method === 'PUT').body, /DTSTART:20270111T100000Z/);
});

test('new requests cannot be approved a second time via the legacy admin endpoint', async () => {
  const env = { DB: { prepare: () => ({ bind: () => ({ first: async () => ({ status: 'requested' }) }) }) } };
  const request = new Request('https://example.com/api/admin/approve', { method: 'POST', body: JSON.stringify({ bookingId: 'id' }) });
  const response = await approve({ request, env });
  assert.equal(response.status, 409);
});

test('summer availability excludes the local time of a new UTC calendar event', async () => {
  const previousFetch = globalThis.fetch;
  const previousNow = Date.now;
  Date.now = () => Date.parse('2027-07-10T12:00:00Z');
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith('https://api.postcodes.io/')) return Response.json({ result: { latitude: BUSINESS.origin.lat, longitude: BUSINESS.origin.lng } });
    if (init.method === 'REPORT') return new Response('BEGIN:VEVENT\r\nDTSTART:20270712T090000Z\r\nDTEND:20270712T123000Z\r\nEND:VEVENT', { status: 207 });
    if (String(url).endsWith('/principal/')) return new Response('<d:calendar-home-set><d:href>/home/</d:href></d:calendar-home-set>', { status: 207 });
    if (String(url).endsWith('/home/')) return new Response('<d:response><d:href>/home/work/</d:href><d:displayname>Work</d:displayname><d:resourcetype><c:calendar/></d:resourcetype></d:response>', { status: 207 });
    return new Response('<d:current-user-principal><d:href>/principal/</d:href></d:current-user-principal>', { status: 207 });
  };
  try {
    const request = new Request('https://example.com/api/availability?postcode=CV8%201AB&size=M&service=EFD');
    const env = { APPLE_CALDAV_URL: 'https://caldav.icloud.com/', APPLE_USERNAME: 'test', APPLE_APP_SPECIFIC_PASSWORD: 'test' };
    const response = await availability({ request, env });
    const { slots } = await response.json();
    const day = slots.find((slot) => slot.date === '2027-07-12');
    assert.ok(!day.times.includes('10:00'));
    assert.ok(day.times.includes('14:00'));
  } finally {
    Date.now = previousNow;
    globalThis.fetch = previousFetch;
  }
});
