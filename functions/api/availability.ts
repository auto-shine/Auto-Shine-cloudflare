import { detectZone, getDurationMinutes, getTotalPrice, SERVICE_DEFS, type ServiceCode, type Size } from '../lib/booking';
import { isSlotBooked } from '../lib/apple-caldav';

function parseAddons(raw?: string | string[]) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatMinutes(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  let payload: Record<string, any> = params;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    payload = await request.json();
  }

  const postcode = String(payload.postcode ?? params.postcode ?? '').trim();
  const size = String(payload.size ?? params.size ?? '').trim().toUpperCase();
  const serviceCode = String(payload.service ?? payload.serviceCode ?? params.service ?? params.serviceCode ?? '').trim().toUpperCase();
  const date = String(payload.date ?? payload.selectedDate ?? params.date ?? params.selectedDate ?? '').trim();
  const selectedExtras = parseAddons(payload.addons ?? payload.selectedExtras ?? params.addons ?? params.selectedExtras ?? []);
  const zone = String(payload.zone ?? detectZone(postcode) ?? '') || detectZone(postcode);

  if (!postcode || !size || !serviceCode || !date) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  const resolvedSize = (['S', 'M', 'L'].includes(size) ? size : 'M') as Size;
  const resolvedService = (['EFD', 'DCD', 'PC1', 'PC2', 'CC'].includes(serviceCode) ? serviceCode : 'EFD') as ServiceCode;
  const resolvedZone = zone || detectZone(postcode);
  const duration = getDurationMinutes(resolvedService, resolvedSize);

  const days: Array<{ date: string; times: string[] }> = [];
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + offset + 1);

    const dateKey = day.toISOString().slice(0, 10);
    const times: string[] = [];
    let startMinutes = 8 * 60 + 30;
    const endMinutes = 18 * 60;

    while (startMinutes + duration <= endMinutes) {
      const slotStart = formatMinutes(startMinutes);
      const slotEnd = formatMinutes(startMinutes + duration);

      const caldavUrl = env.APPLE_CALDAV_URL as string | undefined;
      const username = env.APPLE_USERNAME as string | undefined;
      const password = env.APPLE_APP_SPECIFIC_PASSWORD as string | undefined;

      let booked = false;
      if (caldavUrl && username && password) {
        booked = await isSlotBooked({
          date: dateKey,
          startTime: slotStart,
          endTime: slotEnd,
          caldavUrl,
          username,
          password
        });
      }

      if (!booked) {
        times.push(slotStart);
      }

      startMinutes += 30;
    }

    if (times.length > 0) {
      days.push({ date: dateKey, times });
    }
  }

  const total = getTotalPrice({
    serviceCode: resolvedService,
    size: resolvedSize,
    zone: resolvedZone,
    addons: selectedExtras
  });

  return Response.json({
    zone: resolvedZone,
    quote: {
      total,
      isFrom: false,
      service: SERVICE_DEFS[resolvedService].name,
      size: resolvedSize,
      days: 1
    },
    days: 1,
    slots: days
  });
};
