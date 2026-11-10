import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../public/js/location-prices.js', import.meta.url), 'utf8');

async function checkPostcode(result, ok = true) {
  let handler;
  const button = { disabled: true };
  const status = { textContent: '' };
  const input = { value: 'CV8 1AB' };
  const prices = ['EFD', 'DCD', 'PC1', 'CC'].map((code) => ({ dataset: { servicePrice: code }, textContent: '' }));
  const form = {
    querySelector(selector) { return selector === 'input' ? input : selector === 'button' ? button : status; },
    addEventListener(_name, fn) { handler = fn; },
  };
  let url;
  vm.runInNewContext(script, {
    document: { querySelector: () => form, querySelectorAll: () => prices },
    fetch: async (target) => { url = target; return { ok, json: async () => result }; },
  });
  assert.equal(button.disabled, false);
  await handler({ preventDefault() {} });
  return { prices, status, url };
}

test('location prices use the small-car booking quote for the entered postcode', async () => {
  const result = await checkPostcode({ menu: { EFD: { price: 110 }, DCD: { price: 160 }, PC1: { price: 270 }, CC: { price: 570 } } });
  assert.equal(result.url, '/api/quote?postcode=CV8%201AB&size=S');
  assert.deepEqual(result.prices.map((price) => price.textContent), ['From £110', 'From £160', 'From £270', 'From £570']);
  assert.match(result.status.textContent, /starting prices for a small car/i);
});

test('out-of-area customers are directed to request a travel quote', async () => {
  const result = await checkPostcode({ outOfArea: true });
  assert.match(result.status.textContent, /outside online booking/i);
  assert.ok(result.prices.every((price) => price.textContent === 'Check your postcode'));
});

test('all local location pages use the same postcode-based prices', () => {
  const directory = new URL('../public/', import.meta.url);
  const pages = readdirSync(directory).filter((name) => name.endsWith('.html')).map((name) => [name, readFileSync(new URL(name, directory), 'utf8')]);
  const locations = pages.filter(([, html]) => html.includes('data-location-prices'));
  assert.equal(locations.length, 43);
  const cards = pages.find(([name]) => name === 'redditch.html')[1].match(/<section class="grid4">[\s\S]*?<\/section>/)[0];
  for (const [name, html] of locations) {
    const section = html.match(/<section class="grid4">[\s\S]*?<\/section>/)?.[0];
    assert.equal(section, cards, `${name} must show the full service details and booking links`);
    for (const code of ['EFD', 'DCD', 'PC1', 'CC']) assert.equal((html.match(new RegExp(`data-service-price="${code}"`, 'g')) || []).length, 1, `${name}: ${code}`);
    assert.ok(html.includes('/js/location-prices.js'), name);
    assert.doesNotMatch(html, /15 miles|£1 per mile|fixed price/i, name);
  }
});
