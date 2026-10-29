import { getDurationMinutes, detectZone, getTotalPrice, type ServiceCode, type Size } from '../lib/booking';
import { isSlotBooked } from '../lib/apple-caldav';

export const onRequest: PagesFunction = async ({ request, env }) => {
  try {
    const { postcode, date, serviceCode, size, zone, selectedExtras = [] } = await request.json();

    if (!postcode || !date || !serviceCode || !size) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    const resolvedZone = zone || detectZone(postcode);
    const duration = getDurationMinutes(serviceCode as ServiceCode, size as Size);

    const slots = [];
    let startMinutes = 8 * 60 + 30; // 08:30
    const endMinutes = 18 * 60; // 18:00

    const dateLabel = new Date(`${date}T00:00:00Z`).toISOString().slice(0,10);

    while (startMinutes + duration <= endMinutes) {
      const slotStartHHMM = formatMinutes(startMinutes);
      const slotEndHHMM = formatMinutes(startMinutes + duration);

      const booked = await isSlotBooked({
        date: dateLabel,
        startTime: slotStartHHMM,
        endTime: slotEndHHMM,
        caldavUrl: env.APPLE_CALDAV_URL,
        username: env.APPLE_USERNAME,
        password: env.APPLE_APP_SPECIFIC_PASSWORD
      });

      if (!booked) {
        slots.push({
          start: slotStartHHMM,
          end: slotEndHHMM,
          price: getTotalPrice({
            serviceCode: serviceCode as ServiceCode,
            size: size as Size,
            zone: resolvedZone,
            addons: selectedExtras
          })
        });
      }

      startMinutes += 30;
    }

    return Response.json({
      zone: resolvedZone,
      slots
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Availability check failed' }, { status: 500 });
  }
};

function formatMinutes(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}