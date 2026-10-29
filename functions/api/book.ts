import { detectZone, getDurationMinutes, getTotalPrice, SERVICE_DEFS, type ServiceCode, type Size } from '../lib/booking';
import { sendEmail } from '../lib/email';

export const onRequest: PagesFunction = async ({ request, env, waitUntil }) => {
  try {
    const body = await request.json();

    const required = [
      'postcode',
      'size',
      'serviceCode',
      'selectedDate',
      'selectedTime',
      'customerName',
      'phone',
      'email',
      'carDetails'
    ];

    for (const key of required) {
      if (!body[key] || String(body[key]).trim() === '') {
        return Response.json({ error: `Missing field: ${key}` }, { status: 400 });
      }
    }

    const postcode = String(body.postcode).trim();
    const size = String(body.size).toUpperCase();
    const serviceCode = String(body.serviceCode).toUpperCase();
    const zone = detectZone(postcode);

    if (!['S', 'M', 'L'].includes(size)) {
      return Response.json({ error: 'Invalid size' }, { status: 400 });
    }

    if (!['EFD', 'DCD', 'PC1', 'PC2', 'CC'].includes(serviceCode)) {
      return Response.json({ error: 'Invalid service' }, { status: 400 });
    }

    const selectedExtras = Array.isArray(body.extras) ? body.extras : [];
    const totalPrice = getTotalPrice({
      serviceCode: serviceCode as ServiceCode,
      size: size as Size,
      zone,
      addons: selectedExtras
    });

    const startDate = body.selectedDate;
    const startTime = body.selectedTime;
    const start = new Date(`${startDate}T${startTime}:00`);
    const durationMinutes = getDurationMinutes(serviceCode as ServiceCode, size as Size);

    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    if (start.getTime() < Date.now() + 2 * 24 * 60 * 60 * 1000) {
      return Response.json({ error: 'Bookings must be at least 2 days in advance.' }, { status: 400 });
    }

    const bookingId = crypto.randomUUID();

    const db = env.DB;
    if (!db) {
      return Response.json({ error: 'Database not configured' }, { status: 500 });
    }

    await db.prepare(`
      INSERT INTO bookings (
        id, status, customer_name, phone, email, postcode, zone, car_details,
        service_code, service_name, size, booking_date, booking_time,
        booking_start, booking_end, total_price, notes, add_ons, created_at, updated_at
      ) VALUES (
        ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
      )
    `).bind(
      bookingId,
      body.customerName,
      body.phone,
      body.email,
      postcode,
      zone,
      body.carDetails,
      serviceCode,
      SERVICE_DEFS[serviceCode].name,
      size,
      startDate,
      startTime,
      start.toISOString(),
      end.toISOString(),
      totalPrice,
      body.notes || '',
      JSON.stringify(selectedExtras)
    ).run();

    const adminEmail = env.EMAIL_TO || 'jake@auto-shine.co.uk';
    const from = env.EMAIL_FROM || 'Jake <jake@auto-shine.co.uk>';

    const emailHtml = `
      <h2>New booking request</h2>
      <p><strong>Customer:</strong> ${body.customerName}</p>
      <p><strong>Phone:</strong> ${body.phone}</p>
      <p><strong>Email:</strong> ${body.email}</p>
      <p><strong>Car:</strong> ${body.carDetails}</p>
      <p><strong>Postcode:</strong> ${postcode}</p>
      <p><strong>Zone:</strong> ${zone}</p>
      <p><strong>Service:</strong> ${SERVICE_DEFS[serviceCode].name}</p>
      <p><strong>Size:</strong> ${size}</p>
      <p><strong>Date:</strong> ${startDate}</p>
      <p><strong>Time:</strong> ${startTime}</p>
      <p><strong>Price:</strong> £${totalPrice}</p>
      <p><strong>Notes:</strong> ${body.notes || 'None'}</p>
      <p><strong>Add-ons:</strong> ${(selectedExtras.length ? selectedExtras.join(', ') : 'None')}</p>
      <p>Approve or reject in the admin dashboard.</p>
    `;

    await sendEmail({
      to: adminEmail,
      from,
      subject: `New AutoShine booking request - ${body.customerName}`,
      html: emailHtml
    });

    return Response.json({
      success: true,
      bookingId,
      message: 'Thanks for your booking request. We’ve received it and will contact you to confirm your appointment.'
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Booking failed' }, { status: 500 });
  }
};