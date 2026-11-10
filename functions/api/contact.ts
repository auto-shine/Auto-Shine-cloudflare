import { sendEmail } from '../lib/email.ts';

const services = new Set([
  'Maintenance Detail', 'Essential Detail', 'Deep Clean & Reset',
  'Paint Correction / Ceramic Coating', 'Other / Unsure',
]);
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  let data: unknown;
  try {
    const body = await request.text();
    if (body.length > 10000) return Response.json({ error: 'Enquiry is too long.' }, { status: 413 });
    data = JSON.parse(body);
  } catch {
    return Response.json({ error: 'Invalid enquiry.' }, { status: 400 });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return Response.json({ error: 'Invalid enquiry.' }, { status: 400 });
  }
  const values = data as Record<string, unknown>;
  const field = (name: string) => typeof values[name] === 'string' ? values[name].trim() : '';
  const name = field('name'), postcode = field('postcode'), email = field('email');
  const phone = field('phone'), vehicle = field('vehicle'), service = field('service'), message = field('message');
  if (!name || name.length > 100 || !postcode || postcode.length > 20 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      phone.length > 40 || !vehicle || vehicle.length > 120 || !services.has(service) || message.length > 3000) {
    return Response.json({ error: 'Please check the enquiry details.' }, { status: 400 });
  }
  const rows = [
    ['Name', name], ['Postcode', postcode], ['Email', email], ['Phone', phone || 'Not provided'],
    ['Vehicle', vehicle], ['Service', service], ['Additional information', message || 'None'],
  ];
  const html = `<h2>New website enquiry</h2>${rows.map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value).replace(/\n/g, '<br>')}</p>`).join('')}`;
  try {
    await sendEmail({
      to: env.EMAIL_TO || 'jake@auto-shine.co.uk',
      from: env.EMAIL_FROM || 'AutoShine <enquiries@notifications.auto-shine.co.uk>',
      subject: 'New AutoShine website enquiry',
      html,
      replyTo: email,
    }, env.RESEND_API_KEY);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Contact enquiry email failed', error);
    return Response.json({ error: 'Could not send enquiry. Please contact Jake directly.' }, { status: 503 });
  }
};
