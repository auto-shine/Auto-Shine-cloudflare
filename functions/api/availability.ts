import { resolveZone } from '../../lib/zones.js';
import { getBasePrice, getDurationMinutes, isVariablePrice, SERVICE_DEFS, type ServiceCode, type Size, type Zone } from '../lib/booking';
import { getCalendarEvents } from '../lib/apple-caldav';

const STANDALONE = new Set<ServiceCode>(['ENGINE', 'HL', 'HLUV']);
const ADDON_PRICES: Record<string, number> = {
  engine: 35, 'engine-bay': 35, headlights: 40, 'headlight-restoration': 40,
  headlights_uv: 80, 'headlight-restoration-uv': 80, softtop: 50, 'soft-top': 50,
};
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
  const selectedExtras = parseAddons(payload.addons ?? payload.selectedExtras ?? params.get('addons') ?? params.get('selectedExtras') ?? []);
  if (!postcode || !serviceCode || !SERVICE_DEFS[serviceCode]) return Response.json({ error: 'Please provide a valid postcode and service.' }, { status: 400 });
  if (!sizeInput && !STANDALONE.has(serviceCode)) return Response.json({ error: 'Please select a vehicle size.' }, { status: 400 });
  const size = (['S', 'M', 'L'].includes(sizeInput) ? sizeInput : 'M') as Size;

  let zoneInfo;
  try { zoneInfo = await resolveZone(postcode); }
  catch (error: any) { return Response.json({ error: error?.message || 'Could not validate that postcode.' }, { status: 400 }); }
  if (!zoneInfo.zone) return Response.json({ error: 'That postcode is outside our online booking area. Please message Jake for a travel quote.' }, { status: 400 });
  const zone = zoneInfo.zone as Zone;
  const duration = getDurationMinutes(serviceCode, size);
  const calendarUrl = env.APPLE_CALDAV_URL as string | undefined;
  const username = env.APPLE_USERNAME as string | undefined;
  const password = env.APPLE_APP_SPECIFIC_PASSWORD as string | undefined;
  let calendarEvents: Array<{ start: string; end: string }> = [];
  if (calendarUrl && username && password) {
    try { calendarEvents = await getCalendarEvents({ caldavUrl: calendarUrl, username, password }); }
    catch (error: any) { return Response.json({ error: 'We could not load booking availability right now. Please try again or contact us on WhatsApp.' }, { status: 503 }); }
  }

  const days: Array<{ date: string; times: string[] }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = 1; offset <= 30; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    if (day.getDay() === 0) continue;
    const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const times: string[] = [];
    for (let startMinutes = 8 * 60 + 30; startMinutes + duration <= 18 * 60; startMinutes += 30) {
      const slotStart = formatMinutes(startMinutes);
      const slotEnd = formatMinutes(startMinutes + duration);
      const slotStartMs = new Date(`${dateKey}T${slotStart}:00`).getTime();
      const slotEndMs = new Date(`${dateKey}T${slotEnd}:00`).getTime();
      const overlaps = calendarEvents.some((event) => slotStartMs < new Date(event.end).getTime() && slotEndMs > new Date(event.start).getTime());
      if (!overlaps) times.push(slotStart);
    }
    if (times.length) days.push({ date: dateKey, times });
  }

  const total = getBasePrice(serviceCode, size, zone) + selectedExtras.reduce((sum, addon) => sum + (ADDON_PRICES[addon] || 0), 0);
  return Response.json({
    postcode: zoneInfo.postcode, zone, area: zoneInfo.area || zone, miles: zoneInfo.miles,
    quote: { total, isFrom: isVariablePrice(serviceCode), service: SERVICE_DEFS[serviceCode].name, size, days: 1 },
    pricingNotice: 'Prices marked “from” are starting estimates. We’ll confirm your final price during booking confirmation; photos or an inspection may be needed.',
    days: 1, slots: days,
  });
};
