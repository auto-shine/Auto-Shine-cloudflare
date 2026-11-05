import type { Zone } from './booking';

type Credentials = { caldavUrl: string; username: string; password: string; calendarName?: string };

const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

async function dav(url: string, method: string, auth: string, body: string, depth: string) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Basic ${auth}`, Depth: depth, 'Content-Type': 'application/xml; charset=utf-8' },
    body
  });
  if (!res.ok && res.status !== 207) throw new Error(`Calendar ${method} failed: ${res.status} ${res.statusText}`);
  return res.text();
}

function firstHref(xml: string, prop: string) {
  const block = xml.match(new RegExp(`<[^>]*${prop}[^>]*>([\\s\\S]*?)</[^>]*${prop}>`, 'i'));
  const href = block?.[1].match(/<[^>]*href[^>]*>([^<]+)</i);
  return href ? decodeXml(href[1].trim()) : null;
}

// iCloud needs discovery: server root -> user principal -> calendar home -> the named calendar.
export async function resolveCalendarUrl({ caldavUrl, username, password, calendarName = 'Work' }: Credentials) {
  const auth = btoa(`${username}:${password}`);
  const root = new URL(caldavUrl);
  const ns = 'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"';

  const principalXml = await dav(root.toString(), 'PROPFIND', auth,
    `<d:propfind ${ns}><d:prop><d:current-user-principal/></d:prop></d:propfind>`, '0');
  const principal = firstHref(principalXml, 'current-user-principal');
  if (!principal) throw new Error('Calendar discovery failed: no user principal');

  const principalUrl = new URL(principal, root).toString();
  const homeXml = await dav(principalUrl, 'PROPFIND', auth,
    `<d:propfind ${ns}><d:prop><c:calendar-home-set/></d:prop></d:propfind>`, '0');
  const home = firstHref(homeXml, 'calendar-home-set');
  if (!home) throw new Error('Calendar discovery failed: no calendar home');

  const homeUrl = new URL(home, root).toString();
  const listXml = await dav(homeUrl, 'PROPFIND', auth,
    `<d:propfind ${ns}><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>`, '1');
  const responses = listXml.split(/<(?:\w+:)?response[\s>]/i).slice(1);
  const wanted = calendarName.trim().toLowerCase();
  const seen: string[] = [];
  for (const r of responses) {
    const name = r.match(/<(?:\w+:)?displayname[^>]*>([^<]*)</i)?.[1];
    const href = r.match(/<(?:\w+:)?href[^>]*>([^<]+)</i)?.[1];
    const isCalendar = /<(?:\w+:)?calendar(?:\s[^>]*)?\/?>/i.test(r.match(/<(?:\w+:)?resourcetype[^>]*>([\s\S]*?)<\/(?:\w+:)?resourcetype>/i)?.[1] || '');
    if (!href || !name || !isCalendar) continue;
    seen.push(decodeXml(name).trim());
    if (decodeXml(name).trim().toLowerCase() === wanted) return new URL(decodeXml(href.trim()), homeUrl).toString();
  }
  throw new Error(`Calendar "${calendarName}" not found. Calendars seen: ${seen.join(', ') || 'none'}`);
}

export async function getCalendarEvents(creds: Credentials) {
  const calendarUrl = await resolveCalendarUrl(creds);
  const auth = btoa(`${creds.username}:${creds.password}`);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const from = new Date(); from.setDate(from.getDate() - 1);
  const to = new Date(); to.setDate(to.getDate() + 90);

  const xml = await dav(calendarUrl, 'REPORT', auth,
    `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop>` +
    `<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${fmt(from)}" end="${fmt(to)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`, '1');
  return parseCalendarText(decodeXml(xml).replace(/<!\[CDATA\[|\]\]>/g, ''));
}

function parseCalendarText(text: string) {
  const events: Array<{ start: string; end: string; summary: string }> = [];

  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const summaryMatch = block.match(/SUMMARY[^:\r\n]*:(.*)/);
    const startMatch = block.match(/DTSTART[^:\r\n]*:(.+)/);
    const endMatch = block.match(/DTEND[^:\r\n]*:(.+)/);

    if (!startMatch || !endMatch) continue;

    const summary = summaryMatch ? summaryMatch[1].replace(/\\n/g, ' ').trim() : 'Booked';
    const start = normalizeICSDate(startMatch[1].trim());
    const end = normalizeICSDate(endMatch[1].trim());

    events.push({ start, end, summary });
  }

  return events;
}

function normalizeICSDate(raw: string) {
  const cleaned = raw.replace(/Z/g, '').replace(/\\n/g, '').trim();

  if (cleaned.length === 8) {
    // date only
    const year = Number(cleaned.slice(0, 4));
    const month = Number(cleaned.slice(4, 6));
    const day = Number(cleaned.slice(6, 8));
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
  }

  if (cleaned.length >= 15) {
    const year = Number(cleaned.slice(0, 4));
    const month = Number(cleaned.slice(4, 6));
    const day = Number(cleaned.slice(6, 8));
    const hour = Number(cleaned.slice(9, 11));
    const minute = Number(cleaned.slice(11, 13));
    const second = Number(cleaned.slice(13, 15) || '00');

    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
  }

  return new Date().toISOString();
}

export async function isSlotBooked({
  date,
  startTime,
  endTime,
  caldavUrl,
  username,
  password
}: {
  date: string;
  startTime: string;
  endTime: string;
  caldavUrl: string;
  username: string;
  password: string;
}) {
  const events = await getCalendarEvents({ caldavUrl, username, password });

  const bookingStart = new Date(`${date}T${startTime}:00`).getTime();
  const bookingEnd = new Date(`${date}T${endTime}:00`).getTime();

  return events.some(event => {
    const eventStart = new Date(event.start).getTime();
    const eventEnd = new Date(event.end).getTime();
    return bookingStart < eventEnd && bookingEnd > eventStart;
  });
}

export function createCalendarEventIcs({
  title,
  description,
  startIso,
  endIso,
  location
}: {
  title: string;
  description: string;
  startIso: string;
  endIso: string;
  location: string;
}) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const fmt = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AutoShine//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@autoshine.co.uk`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

export async function createCalendarEvent({
  caldavUrl,
  username,
  password,
  calendarName,
  title,
  description,
  startIso,
  endIso,
  location
}: {
  caldavUrl: string;
  username: string;
  password: string;
  calendarName?: string;
  title: string;
  description: string;
  startIso: string;
  endIso: string;
  location: string;
}) {
  const ics = createCalendarEventIcs({ title, description, startIso, endIso, location });
  const auth = btoa(`${username}:${password}`);

  const eventUrl = new URL(await resolveCalendarUrl({ caldavUrl, username, password, calendarName }));
  eventUrl.pathname = `${eventUrl.pathname.replace(/\/$/, '')}/${crypto.randomUUID()}.ics`;

  const res = await fetch(eventUrl.toString(), {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'text/calendar; charset=utf-8'
    },
    body: ics
  });

  if (!res.ok) {
    throw new Error(`Apple Calendar write failed: ${res.status} ${res.statusText}`);
  }

  return true;
}