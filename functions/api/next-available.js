export async function onRequestGet() {
  return Response.json({
    ok: true,
    available: true,
    label: "Tomorrow"
  }, {
    headers: {
      "Content-Type": "application/json"
    }
  });
}
