import { createCalendarEvent } from '../../lib/apple-caldav';
import { sendEmail } from '../../lib/email';

export const onRequest: PagesFunction = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json();

  const bookingId = body.bookingId;
  if (!bookingId) {
    return Response.json({ error: 'Missing bookingId' }, { status: 400 });
  }

  const db = env.DB;
  if (!db) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }

  const row = await db.prepare(`
    SELECT * FROM bookings WHERE id = ?
  `).bind(bookingId).first();

  if (!row) {
    return Response.json({ error: 'Booking not found' }, { status: 404 });
  }

  const now = new Date();
  const start = new Date(String(row.booking_start));
  const end = new Date(String(row.booking_end));

  const addOnText = row.add_ons ? JSON.parse(String(row.add_ons)) : [];
  const title = `${row.service_name} - ${row.customer_name}`;
  const desc = [
    `Customer: ${row.customer_name}`,
    `Phone: ${row.phone}`,
    `Email: ${row.email}`,
    `Car: ${row.car_details}`,
    `Postcode: ${row.postcode}`,
    `Add-ons: ${addOnText.length ? addOnText.join(', ') : 'None'}`,
    `Notes: ${row.notes || 'None'}`
  ].join('\n');

  try {
    await createCalendarEvent({
      caldavUrl: env.APPLE_CALDAV_URL,
      username: env.APPLE_USERNAME,
      password: env.APPLE_APP_SPECIFIC_PASSWORD,
      title,
      description: desc,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      location: row.postcode
    });
  } catch (error: any) {
    return Response.json({ error: `Calendar write failed: ${error.message}` }, { status: 500 });
  }

  await db.prepare(`
    UPDATE bookings
    SET status = 'approved', updated_at = datetime('now')
    WHERE id = ?
  `).bind(bookingId).run();

  await sendEmail({
    to: row.email,
    from: env.EMAIL_FROM || 'Jake <jake@auto-shine.co.uk>',
    subject: 'Your AutoShine booking has been confirmed',
    html: `
      <h2>Your booking has been confirmed</h2>
      <p>Hi ${row.customer_name},</p>
      <p>Your booking request for ${row.service_name} has been confirmed.</p>
      <p><strong>Date:</strong> ${row.booking_date}</p>
      <p><strong>Time:</strong> ${row.booking_time}</p>
      <p><strong>Location:</strong> ${row.postcode}</p>
      <p><strong>Price:</strong> £${row.total_price}</p>
      <p>Thanks,</p>
      <p>AutoShine</p>
    `
  });

  return Response.json({
    success: true,
    message: 'Booking approved and Apple Calendar event created.'
  });
};