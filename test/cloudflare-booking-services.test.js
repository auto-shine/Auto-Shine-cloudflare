import test from 'node:test';
import assert from 'node:assert/strict';
import { getBasePrice, getDurationMinutes, getTotalPrice, isVariablePrice } from '../functions/lib/booking.ts';

const zones = ['Z1', 'Z2', 'Z3'];

test('standalone engine and headlight services use zone prices independent of vehicle size', () => {
  assert.deepEqual(zones.map((zone) => getBasePrice('ENGINE', 'S', zone)), [50, 60, 70]);
  assert.deepEqual(zones.map((zone) => getBasePrice('HL', 'S', zone)), [50, 60, 70]);
  assert.deepEqual(zones.map((zone) => getBasePrice('HLUV', 'S', zone)), [80, 90, 100]);
  for (const zone of zones) {
    for (const code of ['ENGINE', 'HL', 'HLUV']) {
      const prices = ['S', 'M', 'L'].map((size) => getTotalPrice({ serviceCode: code, size, zone }));
      assert.deepEqual(prices, [prices[0], prices[0], prices[0]]);
      assert.equal(isVariablePrice(code), true);
    }
  }
  assert.equal(getDurationMinutes('HL', 'S'), getDurationMinutes('HL', 'L'));
  assert.equal(getDurationMinutes('HLUV', 'S'), getDurationMinutes('HLUV', 'L'));
});
