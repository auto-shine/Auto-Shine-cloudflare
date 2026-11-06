export async function sendNtfyMe(token: string, message: string): Promise<boolean> {
  try {
    const response = await fetch('https://ntfyme.net/msg', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: message,
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      console.error(`Ntfy me notification failed: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch {
    console.error('Ntfy me notification failed: network error or timeout');
    return false;
  }
}
