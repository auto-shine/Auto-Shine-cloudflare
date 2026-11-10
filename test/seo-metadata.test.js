import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicDir = new URL('../public/', import.meta.url);
const read = (file) => readFileSync(new URL(file, publicDir), 'utf8');

function metadata(html, file) {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
  assert.ok(title, `${file} has no title`);
  assert.ok(description, `${file} has no description`);
  return { title, description };
}

test('sitemap pages have unique metadata consistent with social previews', () => {
  const sitemap = read('sitemap.xml');
  const locations = [...sitemap.matchAll(/<loc>https:\/\/www\.auto-shine\.co\.uk([^<]*)<\/loc>/g)];
  assert.ok(locations.length > 0);
  const titles = new Set();
  const descriptions = new Set();
  for (const [, path] of locations) {
    const file = path ? `${path.slice(1)}.html` : 'index.html';
    const html = read(file);
    const { title, description } = metadata(html, file);
    assert.ok(!titles.has(title), `Duplicate title: ${file}`);
    assert.ok(!descriptions.has(description), `Duplicate description: ${file}`);
    titles.add(title);
    descriptions.add(description);
    assert.ok(html.includes(`<meta property="og:title" content="${title}">`), file);
    assert.ok(html.includes(`<meta name="twitter:title" content="${title}">`), file);
    assert.ok(html.includes(`<meta property="og:description" content="${description}">`), file);
    assert.ok(html.includes(`<meta name="twitter:description" content="${description}">`), file);
    assert.doesNotMatch(html, /<meta\s+name="robots"\s+content="[^"]*noindex/i, file);
  }
});

test('both booking page variants share the same search metadata', () => {
  assert.deepEqual(metadata(read('book/index.html'), 'book/index.html'), metadata(read('book.html'), 'book.html'));
});
