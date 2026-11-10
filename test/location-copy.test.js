import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

test('all local location pages have distinct, useful introductions', () => {
  const dir = new URL('../public/', import.meta.url);
  const pages = readdirSync(dir).filter((file) => file.endsWith('.html')).map((file) => [file, readFileSync(new URL(file, dir), 'utf8')]);
  const locations = pages.filter(([, html]) => html.includes('data-location-prices'));
  const headings = new Set();
  const paragraphs = new Set();
  assert.equal(locations.length, 43);
  for (const [file, html] of locations) {
    const intro = html.match(/<section class="intro">([\s\S]*?)<\/section>/)?.[1];
    assert.ok(intro, `${file} has no introduction`);
    const heading = intro.match(/<h2>(.*?)<\/h2>/)?.[1];
    const text = [...intro.matchAll(/<p>(.*?)<\/p>/g)].map((match) => match[1]);
    assert.ok(heading && text.length >= 2, `${file} needs a heading and two paragraphs`);
    assert.ok(!headings.has(heading), `${file} repeats a heading`);
    headings.add(heading);
    for (const paragraph of text.slice(0, 2)) {
      assert.ok(paragraph.length >= 120, `${file} has an unexpectedly short paragraph`);
      assert.ok(!paragraphs.has(paragraph), `${file} repeats a paragraph`);
      paragraphs.add(paragraph);
    }
    assert.doesNotMatch(intro, /customers mostly book|most .* customers book/i, file);
  }
});
