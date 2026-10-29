export async function onRequestPost({ request }) {
  try {
    const body = await request.json();

    return new Response(JSON.stringify({
      ok: true,
      message: 'Booking request received',
      payload: body
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Invalid booking request'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
