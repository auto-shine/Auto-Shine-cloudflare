import type { Zone } from './booking';

export async function getCalendarEvents({
  caldavUrl,
  username,
  password
}: {
  caldavUrl: string;
  username: string;
  password: string;
}) {
  const auth = btoa(`${username}:${password}`);

  const res = await fetch(caldavUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'text/calendar, application/xml, text/xml'
    }
  });

  if (!res.ok) {
    throw new Error(`Calendar fetch failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  return parseCalendarText(text);
}

function parseCalendarText(text: string) {
  const events: Array<{ start: string; end: string; summary: string }> = [];

  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const summaryMatch = block.match(/SUMMARY:(.*)/);
    const startMatch = block.match(/DTSTART(?:;VALUE=DATE)?:(.+)/);
    const endMatch = block.match(/DTEND(?:;VALUE=DATE)?:(.+)/);

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
  title,
  description,
  startIso,
  endIso,
  location
}: {
  caldavUrl: string;
  username: string;
  password: string;
  title: string;
  description: string;
  startIso: string;
  endIso: string;
  location: string;
}) {
  const ics = createCalendarEventIcs({ title, description, startIso, endIso, location });
  const auth = btoa(`${username}:${password}`);

  const eventUrl = new URL(caldavUrl);
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