import { resolveZone } from '../../lib/zones.js';
import { getDurationMinutes, getTotalPrice, SERVICE_DEFS, type ServiceCode, type Size, type Zone } from '../lib/booking';
import { sendEmail } from '../lib/email';

const STANDALONE = new Set<ServiceCode>(['ENGINE', 'HL', 'HLUV']);

export const onRequest: PagesFunction = async ({ request, env, waitUntil }) => {
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
    const totalPrice = getTotalPrice({ serviceCode, size, zone, addons: selectedExtras });
    const start = new Date(`${selectedDate}T${selectedTime}:00`);
    if (!Number.isFinite(start.getTime())) return Response.json({ error: 'Please choose a valid date and time.' }, { status: 400 });
    const durationMinutes = getDurationMinutes(serviceCode, size);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
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
      ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      bookingId, customerName, phone, email || '', zoneInfo.postcode, zone,
      carDetails, serviceCode, SERVICE_DEFS[serviceCode].name, size,
      selectedDate, selectedTime, start.toISOString(), end.toISOString(),
      totalPrice, orderNotes, JSON.stringify(selectedExtras),
    ).run();

    const emailHtml = `
      <h2>New booking request</h2>
      <p><strong>Customer:</strong> ${customerName}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email || 'Not provided'}</p>
      <p><strong>Car / address:</strong> ${carDetails}</p>
      <p><strong>Postcode:</strong> ${zoneInfo.postcode} (${zoneInfo.miles} miles; ${zone})</p>
      <p><strong>Service:</strong> ${SERVICE_DEFS[serviceCode].name}</p>
      <p><strong>Size:</strong> ${STANDALONE.has(serviceCode) ? 'Not used for standalone pricing' : size}</p>
      <p><strong>Date and time:</strong> ${selectedDate} at ${selectedTime}</p>
      <p><strong>Price:</strong> £${totalPrice}</p>
      <p><strong>Notes:</strong> ${orderNotes || 'None'}</p>
      <p><strong>Add-ons:</strong> ${selectedExtras.length ? selectedExtras.join(', ') : 'None'}</p>
    `;
    waitUntil(sendEmail({
      to: env.EMAIL_TO || 'jake@auto-shine.co.uk',
      from: env.EMAIL_FROM || 'Jake <jake@auto-shine.co.uk>',
      subject: `New AutoShine booking request - ${customerName}`,
      html: emailHtml,
    }, env.RESEND_API_KEY));

    return Response.json({
      success: true,
      booking: {
        id: bookingId, service: SERVICE_DEFS[serviceCode].name, date: selectedDate,
        time: selectedTime, total: totalPrice, isFrom: false, days: 1,
        lines: [{ label: SERVICE_DEFS[serviceCode].name, amount: totalPrice }],
      },
      whatsapp: 'https://wa.me/447999923651?text=' + encodeURIComponent('Hi Jake, I just booked a detail. Can you confirm the details?'),
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Booking failed' }, { status: 500 });
  }
};
