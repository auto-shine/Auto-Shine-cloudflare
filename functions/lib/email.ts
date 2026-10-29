export async function sendEmail(
  {
    to,
    from,
    subject,
    html
  }: {
    to: string;
    from: string;
    subject: string;
    html: string;
  },
  apiKeyOverride?: string
) {
  const apiKey = apiKeyOverride || (globalThis as any).process?.env?.RESEND_API_KEY || '';

  if (!apiKey) {
    console.warn('RESEND_API_KEY missing; skipping email.');
    return { ok: true, skipped: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email send failed: ${res.status} ${text}`);
  }

  return await res.json();
}
