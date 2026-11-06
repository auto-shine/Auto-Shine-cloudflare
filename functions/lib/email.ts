export async function sendEmail(
  {
    to,
    from,
    subject,
    html,
    replyTo
  }: {
    to: string;
    from: string;
    subject: string;
    html: string;
    replyTo?: string;
  },
  apiKeyOverride?: string
) {
  const apiKey = apiKeyOverride || (globalThis as any).process?.env?.RESEND_API_KEY || '';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
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
      html,
      ...(replyTo ? { reply_to: replyTo } : {})
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email send failed: ${res.status} ${text}`);
  }

  return await res.json();
}
