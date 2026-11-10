import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { onRequestPost } from '../functions/api/contact.ts';

const enquiry = {
  name: 'Jamie <Lee>', postcode: 'CV8 1AB', email: 'jamie@example.com',
  phone: '07700900123', vehicle: 'Golf', service: 'Deep Clean & Reset', message: 'Please help.\nThanks!',
};

async function submit(data, { fails = false, missingKey = false } = {}) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return fails ? new Response('provider unavailable', { status: 503 }) : Response.json({ id: 'email-id' });
  };
  try {
    const request = new Request('https://example.com/api/contact', { method: 'POST', body: JSON.stringify(data) });
    const response = await onRequestPost({ request, env: { RESEND_API_KEY: missingKey ? '' : 'test-key' } });
    return { response, body: await response.json(), calls };
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
}

test('enquiries are emailed to Jake with the customer as reply-to', async () => {
  const { response, body, calls } = await submit(enquiry);
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(calls.length, 1);
  const mail = JSON.parse(calls[0].init.body);
  assert.deepEqual(mail.to, ['jake@auto-shine.co.uk']);
  assert.equal(mail.from, 'AutoShine <enquiries@notifications.auto-shine.co.uk>');
  assert.equal(mail.reply_to, enquiry.email);
  assert.match(mail.html, /Jamie &lt;Lee&gt;/);
  assert.match(mail.html, /Please help\.<br>Thanks!/);
});

test('invalid enquiries do not send email', async () => {
  for (const invalid of [{ ...enquiry, email: 'bad' }, { ...enquiry, service: 'Other' }, { ...enquiry, message: 'x'.repeat(3001) }]) {
    const { response, calls } = await submit(invalid);
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  }
});

test('email configuration or provider failure is reported to the customer', async () => {
  for (const options of [{ fails: true }, { missingKey: true }]) {
    const { response, body } = await submit(enquiry, options);
    assert.equal(response.status, 503);
    assert.ok(body.error);
  }
});

test('contact form only clears fields and reports success after sending', async () => {
  const source = readFileSync(new URL('../public/js/site.js', import.meta.url), 'utf8');
  const formScript = source.slice(source.indexOf('const quoteForm ='), source.indexOf('// Count a tap'));
  for (const ok of [true, false]) {
    let submitHandler, reset = false, tracking = false;
    const button = { disabled: true };
    const status = { textContent: '' };
    const form = {
      querySelector: (selector) => selector === '.qf-submit' ? button : status,
      addEventListener: (_event, handler) => { submitHandler = handler; },
      reset: () => { reset = true; },
    };
    vm.runInNewContext(formScript, {
      document: { querySelector: () => form },
      FormData: class { *[Symbol.iterator]() { yield ['name', 'Jamie']; } },
      fetch: async (url, options) => {
        assert.equal(url, '/api/contact');
        assert.equal(JSON.parse(options.body).name, 'Jamie');
        return { ok };
      },
      gtag: () => { tracking = true; },
      console: { error() {} },
    });
    assert.equal(button.disabled, false);
    await submitHandler({ preventDefault() {} });
    assert.equal(reset, ok);
    assert.equal(tracking, ok);
    assert.equal(button.disabled, false);
    assert.match(status.textContent, ok ? /has been sent/ : /could not send/i);
  }
});
