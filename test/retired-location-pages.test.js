import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const publicDir = new URL('../public/', import.meta.url);
const retired = [
  'alderley-edge', 'ascot', 'birmingham', 'bristol', 'cardiff', 'cobham',
  'esher', 'guildford', 'harrogate', 'leeds', 'liverpool', 'london',
  'manchester', 'nottingham', 'oxford', 'sheffield', 'virginia-water', 'windsor',
];

test('retired nationwide pages redirect to relevant services and are absent from the sitemap', () => {
  const redirects = readFileSync(new URL('_redirects', publicDir), 'utf8').trim().split('\n');
  const sitemap = readFileSync(new URL('sitemap.xml', publicDir), 'utf8');
  const pages = readdirSync(publicDir).filter((name) => name.endsWith('.html'));
  for (const slug of retired) {
    assert.equal(existsSync(new URL(`${slug}.html`, publicDir)), false, slug);
    for (const path of [`/${slug}`, `/${slug}.html`]) {
      assert.ok(redirects.includes(`${path} /premium-detailing-services 301`), path);
    }
    assert.ok(!sitemap.includes(`https://www.auto-shine.co.uk/${slug}</loc>`), slug);
    for (const page of pages) {
      const html = readFileSync(new URL(page, publicDir), 'utf8');
      assert.doesNotMatch(html, new RegExp(`href=["']/${slug}(?:\\.html)?(?:["'/?#])`, 'i'), page);
    }
  }
  assert.ok(existsSync(new URL('premium-detailing-services.html', publicDir)));
});
