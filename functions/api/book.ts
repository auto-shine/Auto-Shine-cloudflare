import { resolveZone } from '../../lib/zones.js';
import { parseDateKey, parseTimeLabel, zonedToMs } from '../../lib/time.js';
import { getAllowedStartTimes, getBasePrice, getDurationMinutes, isVariablePrice, SERVICE_DEFS, type ServiceCode, type Size, type Zone } from '../lib/booking.ts';
import { sendEmail } from '../lib/email.ts';
import { createCalendarEvent } from '../lib/apple-caldav.ts';

const STANDALONE = new Set<ServiceCode>(['ENGINE', 'HL', 'HLUV']);
const ADDON_PRICES: Record<string, number> = {
  engine: 35, 'engine-bay': 35, headlights: 40, 'headlight-restoration': 40,
  headlights_uv: 80, 'headlight-restoration-uv': 80, softtop: 50, 'soft-top': 50,
};
const PRICE_NOTICE = 'This is a starting price. We’ll confirm the final price during booking confirmation; photos or an inspection may be needed.';
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const onRequest: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json();
    const postcode = String(body.postcode || '').trim();
    const sizeInput = String(body.size || '').trim().toUpperCase();
    const serviceCode = String(body.service || body.serviceCode || '').trim().toUpperCase() as ServiceCode;
    const selectedDate = String(body.date || body.selectedDate || '').trim();
    const selectedTime = String(body.time || body.selectedTime || '').trim();
    const customerName = String(body.name || body.customerName || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim();
    const address = String(body.address || '').trim();
    const vehicle = String(body.vehicle || body.carDetails || '').trim();
    const notes = String(body.notes || '').trim();
    const selectedExtras: string[] = Array.isArray(body.addons) ? body.addons : [];

    if (!postcode || !serviceCode || !SERVICE_DEFS[serviceCode] || !selectedDate || !selectedTime || !customerName || !phone || !address) {
      return Response.json({ error: 'Missing required booking fields or unsupported service.' }, { status: 400 });
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
    const addonTotal = selectedExtras.reduce((sum, addon) => sum + (ADDON_PRICES[addon] || 0), 0);
    const totalPrice = getBasePrice(serviceCode, size, zone) + addonTotal;
    const isFrom = isVariablePrice(serviceCode);
    const dateParts = parseDateKey(selectedDate);
    const minutes = parseTimeLabel(selectedTime);
    if (!dateParts || minutes === null) return Response.json({ error: 'Please choose a valid date and time.' }, { status: 400 });
    if (!getAllowedStartTimes(serviceCode, selectedDate).includes(selectedTime)) return Response.json({ error: 'That start time is not available for this service. Please choose another slot.' }, { status: 400 });
    const start = new Date(zonedToMs({ ...dateParts, h: Math.floor(minutes / 60), mi: minutes % 60 }, 'Europe/London'));
    const end = new Date(start.getTime() + getDurationMinutes(serviceCode, size) * 60 * 1000);
    const bookingId = crypto.randomUUID();
    const db = env.DB;
    if (!db) return Response.json({ error: 'Database not configured' }, { status: 500 });

    const carDetails = [vehicle, address].filter(Boolean).join(' | ');
    const orderNotes = [notes, address].filter(Boolean).join(' | ');
    await db.prepare(`
      INSERT INTO bookings (
        id, status, customer_name, phone, email, postcode, zone, car_details,
        service_code, service_name, size, booking_date, booking_time, booking_start,
        booking_end, total_price, notes, add_ons, created_at, updated_at
      ) VALUES (?, 'requested', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      bookingId, customerName, phone, email || '', zoneInfo.postcode, zone,
      carDetails, serviceCode, SERVICE_DEFS[serviceCode].name, size,
      selectedDate, selectedTime, start.toISOString(), end.toISOString(),
      totalPrice, orderNotes, JSON.stringify(selectedExtras),
    ).run();

    const description = [
      'Booking request - awaiting confirmation',
      `Customer: ${customerName}`, `Phone: ${phone}`, `Email: ${email || 'Not provided'}`,
      `Car / address: ${carDetails}`, `Postcode: ${zoneInfo.postcode}`,
      `Price: £${totalPrice}${isFrom ? ' (from)' : ''}`,
      `Add-ons: ${selectedExtras.length ? selectedExtras.join(', ') : 'None'}`,
      `Notes: ${orderNotes || 'None'}`,
    ].join('\n');
    let calendarFailed = false;
    try {
      if (!env.APPLE_CALDAV_URL || !env.APPLE_USERNAME || !env.APPLE_APP_SPECIFIC_PASSWORD) {
        throw new Error('Apple Calendar credentials are not configured');
      }
      await createCalendarEvent({
        caldavUrl: env.APPLE_CALDAV_URL, username: env.APPLE_USERNAME,
        password: env.APPLE_APP_SPECIFIC_PASSWORD, calendarName: env.APPLE_CALENDAR_NAME,
        title: `Booking request: ${SERVICE_DEFS[serviceCode].name} - ${customerName}`,
        description, startIso: start.toISOString(), endIso: end.toISOString(), location: address,
      });
    } catch (error) {
      calendarFailed = true;
      console.error(`Calendar write failed for booking ${bookingId}`, error);
    }

    const safe = (value: unknown) => escapeHtml(String(value));
    const emailHtml = `
      <h2>New booking request</h2>
      ${calendarFailed ? '<p><strong>Calendar update failed. Please add this request to your calendar manually.</strong></p>' : ''}
      <p><strong>Customer:</strong> ${safe(customerName)}</p>
      <p><strong>Phone:</strong> ${safe(phone)}</p>
      <p><strong>Email:</strong> ${safe(email || 'Not provided')}</p>
      <p><strong>Car / address:</strong> ${safe(carDetails)}</p>
      <p><strong>Postcode:</strong> ${safe(zoneInfo.postcode)} (${zoneInfo.miles} miles; ${zone})</p>
      <p><strong>Service:</strong> ${safe(SERVICE_DEFS[serviceCode].name)}</p>
      <p><strong>Size:</strong> ${STANDALONE.has(serviceCode) ? 'Does not affect standalone headlight pricing' : size}</p>
      <p><strong>Date and time:</strong> ${safe(selectedDate)} at ${safe(selectedTime)}</p>
      <p><strong>Starting price:</strong> £${totalPrice}${isFrom ? ' (final price to be confirmed; photos or inspection may be needed)' : ''}</p>
      <p><strong>Notes:</strong> ${safe(orderNotes || 'None')}</p>
      <p><strong>Add-ons:</strong> ${safe(selectedExtras.length ? selectedExtras.join(', ') : 'None')}</p>
    `;
    let emailFailed = false;
    try {
      await sendEmail({
        to: env.EMAIL_TO || 'jake@auto-shine.co.uk',
        from: env.EMAIL_FROM || 'Jake <jake@auto-shine.co.uk>',
        subject: 'New AutoShine booking request',
        html: emailHtml,
        replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
      }, env.RESEND_API_KEY);
    } catch (error) {
      emailFailed = true;
      console.error(`Booking email failed for booking ${bookingId}`, error);
    }

    return Response.json({
      success: true,
      contactRequired: calendarFailed || emailFailed,
      booking: {
        id: bookingId, service: SERVICE_DEFS[serviceCode].name, date: selectedDate,
        time: selectedTime, total: totalPrice, isFrom, days: 1,
        lines: [{ label: SERVICE_DEFS[serviceCode].name, amount: totalPrice }],
        pricingNotice: isFrom ? PRICE_NOTICE : undefined,
      },
      whatsapp: 'https://wa.me/447999923651?text=' + encodeURIComponent('Hi Jake, I just booked a detail. Can you confirm the details?'),
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Booking failed' }, { status: 500 });
  }
};
