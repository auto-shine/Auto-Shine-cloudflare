export async function onRequestPost({ request }) {
  try {
    const body = await request.json();

    return Response.json({
      ok: true,
      message: "Booking request received",
      payload: body
    }, {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: "Invalid booking request"
    }, {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
