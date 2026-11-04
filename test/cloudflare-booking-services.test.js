import test from 'node:test';
import assert from 'node:assert/strict';
import { getDurationMinutes, getTotalPrice } from '../functions/lib/booking.ts';

const ZONES = ['Z1', 'Z2', 'Z3'];

test('standalone headlight services vary by travel zone, not vehicle size', () => {
  for (const zone of ZONES) {
    const plain = ['S', 'M', 'L'].map((size) => getTotalPrice({ serviceCode: 'HL', size, zone }));
    const uv = ['S', 'M', 'L'].map((size) => getTotalPrice({ serviceCode: 'HLUV', size, zone }));
    assert.deepEqual(plain, [plain[0], plain[0], plain[0]]);
    assert.deepEqual(uv, [uv[0], uv[0], uv[0]]);
    assert.equal(uv[0] - plain[0], 30);
  }
  assert.deepEqual(ZONES.map((zone) => getTotalPrice({ serviceCode: 'HL', size: 'M', zone })), [50, 60, 70]);
  assert.deepEqual(ZONES.map((zone) => getTotalPrice({ serviceCode: 'HLUV', size: 'M', zone })), [80, 90, 100]);
  assert.equal(getDurationMinutes('HL', 'S'), getDurationMinutes('HL', 'L'));
  assert.equal(getDurationMinutes('HLUV', 'S'), getDurationMinutes('HLUV', 'L'));
});
