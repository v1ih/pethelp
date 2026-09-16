import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate, getWeekdayKey, isWithinRange, asTrimmedString, timeToMinutes } from '../src/modules/appointments/appointments.utils.js';

test('asTrimmedString trims string inputs and ignores non-strings', () => {
  assert.equal(asTrimmedString('  VetPass  '), 'VetPass');
  assert.equal(asTrimmedString(undefined), '');
});

test('timeToMinutes parses valid time strings', () => {
  assert.equal(timeToMinutes('08:30'), 510);
  assert.equal(timeToMinutes('bad'), -1);
});

test('isWithinRange treats the end time as exclusive', () => {
  assert.equal(isWithinRange('09:00', '08:00', '12:00'), true);
  assert.equal(isWithinRange('12:00', '08:00', '12:00'), false);
});

test('getWeekdayKey maps a known date to the expected weekday key', () => {
  assert.equal(getWeekdayKey('2026-06-22'), 'Seg');
  assert.equal(getWeekdayKey('invalid-date'), null);
});

test('formatDate normalizes Date objects and date strings', () => {
  assert.equal(formatDate(new Date('2026-06-22T15:30:00Z')), '2026-06-22');
  assert.equal(formatDate('2026-06-22T15:30:00Z'), '2026-06-22');
});
