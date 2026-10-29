export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get('status') || 'pending';

  const db = env.DB;
  if (!db) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }

  const rows = await db.prepare(`
    SELECT *
    FROM bookings
    WHERE status = ?
    ORDER BY booking_date ASC, booking_time ASC
  `).bind(mode).all();

  return Response.json({
    bookings: rows.results
  });
};