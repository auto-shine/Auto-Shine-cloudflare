import { detectZone, getDurationMinutes, getTotalPrice, SERVICE_DEFS, type ServiceCode, type Size } from '../lib/booking';
import { sendEmail } from '../lib/email';

export const onRequest: PagesFunction = async ({ request, env, waitUntil }) => {
  try {
    const body = await request.json();

    const postcode = String(body.postcode || '').trim();
    const size = String(body.size || '').trim().toUpperCase();
    const serviceCode = String(body.service || body.serviceCode || '').trim().toUpperCase();
    const selectedDate = String(body.date || body.selectedDate || '').trim();
    const selectedTime = String(body.time || body.selectedTime || '').trim();
    const customerName = String(body.name || body.customerName || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim();
    const address = String(body.address || '').trim();
    const vehicle = String(body.vehicle || body.carDetails || '').trim();
    const notes = String(body.notes || '').trim();
    const selectedExtras = Array.isArray(body.addons) ? body.addons : [];

    if (!postcode || !size || !serviceCode || !selectedDate || !selectedTime || !customerName || !phone || !address) {
      return Response.json({ error: 'Missing required booking fields' }, { status: 400 });
    }

    const normalisedSize = (['S', 'M', 'L'].includes(size) ? size : 'M') as Size;
    const normalisedService = (['EFD', 'DCD', 'PC1', 'PC2', 'CC'].includes(serviceCode) ? serviceCode : 'EFD') as ServiceCode;
    const zone = detectZone(postcode);

    const totalPrice = getTotalPrice({
      serviceCode: normalisedService,
      size: normalisedSize,
      zone,
      addons: selectedExtras
    });

    const start = new Date(`${selectedDate}T${selectedTime}:00`);
    const durationMinutes = getDurationMinutes(normalisedService, normalisedSize);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const bookingId = crypto.randomUUID();
    const db = env.DB;

    if (!db) {
      return Response.json({ error: 'Database not configured' }, { status: 500 });
    }

    const carDetails = [vehicle, address].filter(Boolean).join(' | ');
    const orderNotes = [notes, address].filter(Boolean).join(' | ');

    await db.prepare(`
      INSERT INTO bookings (
        id,
        status,
        customer_name,
        phone,
        email,
        postcode,
        zone,
        car_details,
        service_code,
        service_name,
        size,
        booking_date,
        booking_time,
        booking_start,
        booking_end,
        total_price,
        notes,
        add_ons,
        created_at,
        updated_at
      ) VALUES (
        ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
      )
    `).bind(
      bookingId,
      customerName,
      phone,
      email || '',
      postcode,
      zone,
      carDetails,
      normalisedService,
      SERVICE_DEFS[normalisedService].name,
      normalisedSize,
      selectedDate,
      selectedTime,
      start.toISOString(),
      end.toISOString(),
      totalPrice,
      orderNotes,
      JSON.stringify(selectedExtras)
    ).run();

    const adminEmail = env.EMAIL_TO || 'jake@auto-shine.co.uk';
    const from = env.EMAIL_FROM || 'Jake <jake@auto-shine.co.uk>';

    const emailHtml = `
      <h2>New booking request</h2>
      <p><strong>Customer:</strong> ${customerName}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email || 'Not provided'}</p>
      <p><strong>Car:</strong> ${carDetails}</p>
      <p><strong>Postcode:</strong> ${postcode}</p>
      <p><strong>Zone:</strong> ${zone}</p>
      <p><strong>Service:</strong> ${SERVICE_DEFS[normalisedService].name}</p>
      <p><strong>Size:</strong> ${normalisedSize}</p>
      <p><strong>Date:</strong> ${selectedDate}</p>
      <p><strong>Time:</strong> ${selectedTime}</p>
      <p><strong>Price:</strong> £${totalPrice}</p>
      <p><strong>Notes:</strong> ${orderNotes || 'None'}</p>
      <p><strong>Add-ons:</strong> ${(selectedExtras.length ? selectedExtras.join(', ') : 'None')}</p>
    `;

    waitUntil(
      sendEmail({
        to: adminEmail,
        from,
        subject: `New AutoShine booking request - ${customerName}`,
        html: emailHtml
      }, env.RESEND_API_KEY)
    );

    return Response.json({
      success: true,
      booking: {
        id: bookingId,
        service: SERVICE_DEFS[normalisedService].name,
        date: selectedDate,
        time: selectedTime,
        total: totalPrice,
        isFrom: false,
        days: 1,
        lines: [
          { label: SERVICE_DEFS[normalisedService].name, amount: totalPrice }
        ]
      },
      whatsapp: 'https://wa.me/447999923651?text=' + encodeURIComponent('Hi Jake, I just booked a detail. Can you confirm the details?')
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Booking failed' }, { status: 500 });
  }
};
