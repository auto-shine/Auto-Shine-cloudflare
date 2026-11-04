import { resolveZone } from '../../lib/zones.js';
import { getDurationMinutes, getTotalPrice, SERVICE_DEFS, type ServiceCode, type Size, type Zone } from '../lib/booking';
import { isSlotBooked } from '../lib/apple-caldav';

const STANDALONE = new Set<ServiceCode>(['ENGINE', 'HL', 'HLUV']);

function parseAddons(raw?: string | string[]) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw).split(',').map((part) => part.trim()).filter(Boolean);
}

function formatMinutes(totalMinutes: number) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const params = url.searchParams;
  let payload: Record<string, any> = Object.fromEntries(params.entries());
  if ((request.headers.get('content-type') || '').includes('application/json')) payload = await request.json();

  const postcode = String(payload.postcode ?? params.get('postcode') ?? '').trim();
  const sizeInput = String(payload.size ?? params.get('size') ?? '').trim().toUpperCase();
  const serviceCode = String(payload.service ?? payload.serviceCode ?? params.get('service') ?? params.get('serviceCode') ?? '').trim().toUpperCase() as ServiceCode;
  const addons = parseAddons(payload.addons ?? payload.selectedExtras ?? params.get('addons') ?? params.get('selectedExtras') ?? []);
  if (!postcode || !serviceCode || !SERVICE_DEFS[serviceCode]) {
    return Response.json({ error: 'Please provide a valid postcode and service.' }, { status: 400 });
  }
  if (!sizeInput && !STANDALONE.has(serviceCode)) return Response.json({ error: 'Please select a vehicle size.' }, { status: 400 });

  const size = (['S', 'M', 'L'].includes(sizeInput) ? sizeInput : 'M') as Size;
  let zoneInfo;
  try {
    zoneInfo = await resolveZone(postcode);
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Could not validate that postcode.' }, { status: 400 });
  }
  if (!zoneInfo.zone) return Response.json({ error: 'That postcode is outside our online booking area. Please message Jake for a travel quote.' }, { status: 400 });

  const zone = zoneInfo.zone as Zone;
  const duration = getDurationMinutes(serviceCode, size);
  const days: Array<{ date: string; times: string[] }> = [];
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + offset + 1);
    const dateKey = day.toISOString().slice(0, 10);
    const times: string[] = [];
    for (let startMinutes = 8 * 60 + 30; startMinutes + duration <= 18 * 60; startMinutes += 30) {
      const slotStart = formatMinutes(startMinutes);
      const slotEnd = formatMinutes(startMinutes + duration);
      const caldavUrl = env.APPLE_CALDAV_URL as string | undefined;
      const username = env.APPLE_USERNAME as string | undefined;
      const password = env.APPLE_APP_SPECIFIC_PASSWORD as string | undefined;
      let booked = false;
      if (caldavUrl && username && password) {
        booked = await isSlotBooked({ date: dateKey, startTime: slotStart, endTime: slotEnd, caldavUrl, username, password });
      }
      if (!booked) times.push(slotStart);
    }
    if (times.length) days.push({ date: dateKey, times });
  }

  const total = getTotalPrice({ serviceCode, size, zone, addons });
  return Response.json({
    postcode: zoneInfo.postcode, zone, area: zoneInfo.area || zone, miles: zoneInfo.miles,
    quote: { total, isFrom: false, service: SERVICE_DEFS[serviceCode].name, size, days: 1 },
    days: 1, slots: days,
  });
};
