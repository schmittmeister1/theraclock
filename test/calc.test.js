/* Unit tests for TheraClock's core math. Run: node test/calc.test.js */

'use strict';

var assert = require('assert');
var app = require('../app.js');
var calcDay = app.calcDay;
var fmtDuration = app.fmtDuration;
var fmtClock = app.fmtClock;
var parseTimeValue = app.parseTimeValue;
var minutesToUnits = app.minutesToUnits;
var unitsToMinutes = app.unitsToMinutes;

var passed = 0;

function check(name, fn) {
  fn();
  passed++;
  console.log('  ok - ' + name);
}

console.log('calcDay');

check('classic SNF day: 8:00 start, 6h billed, 30m break, 75% -> 4:30 PM', function () {
  var r = calcDay({ startMin: 480, billedMin: 360, breakMin: 30, productivityPct: 75 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(Math.round(r.workedMin), 480);        // 6h / 0.75 = 8h working
  assert.strictEqual(Math.round(r.nonBillableMin), 120);   // 2h non-billable
  assert.strictEqual(r.endMinOfDay, 990);                  // 16:30
  assert.strictEqual(r.dayOffset, 0);
});

check('90% productivity: 8:00 start, 24 units (6h), 30m break -> 3:10 PM', function () {
  var r = calcDay({ startMin: 480, billedMin: unitsToMinutes(24), breakMin: 30, productivityPct: 90 });
  // 360 / 0.9 = 400 min working; 480+400+30 = 910 = 15:10
  assert.strictEqual(r.endMinOfDay, 910);
  assert.strictEqual(Math.round(r.nonBillableMin), 40);
});

check('100% productivity: working time equals billed time', function () {
  var r = calcDay({ startMin: 540, billedMin: 300, breakMin: 60, productivityPct: 100 });
  assert.strictEqual(Math.round(r.workedMin), 300);
  assert.strictEqual(Math.round(r.nonBillableMin), 0);
  assert.strictEqual(r.endMinOfDay, 900);                  // 9:00 + 5h + 1h = 15:00
});

check('no break is fine', function () {
  var r = calcDay({ startMin: 420, billedMin: 480, breakMin: 0, productivityPct: 80 });
  assert.strictEqual(Math.round(r.workedMin), 600);        // 8h / 0.8 = 10h
  assert.strictEqual(r.endMinOfDay, 1020);                 // 7:00 + 10h = 17:00
});

check('over 100% (concurrent billing): billed exceeds working time', function () {
  var r = calcDay({ startMin: 480, billedMin: 360, breakMin: 0, productivityPct: 120 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(Math.round(r.workedMin), 300);        // 6h / 1.2 = 5h
  assert.strictEqual(r.nonBillableMin, 0);                 // clamped, not negative
});

check('crosses midnight: 6:00 PM start, 8h billed, 70% -> next day + flag', function () {
  var r = calcDay({ startMin: 1080, billedMin: 480, breakMin: 30, productivityPct: 70 });
  // 480/0.7 = 685.71 -> total 715.71 -> end 1795.71 -> round 1796 -> 356 next day (5:56 AM)
  assert.strictEqual(r.dayOffset, 1);
  assert.strictEqual(r.endMinOfDay, 356);
});

check('fractional minutes round to nearest minute', function () {
  var r = calcDay({ startMin: 480, billedMin: 375, breakMin: 0, productivityPct: 85 });
  // 375/0.85 = 441.18 -> end 921.18 -> rounds to 921 (3:21 PM)
  assert.strictEqual(r.endMinOfDay, 921);
});

console.log('validation');

check('rejects zero/negative billed time', function () {
  assert.strictEqual(calcDay({ startMin: 480, billedMin: 0, breakMin: 0, productivityPct: 90 }).ok, false);
  assert.strictEqual(calcDay({ startMin: 480, billedMin: -15, breakMin: 0, productivityPct: 90 }).ok, false);
});

check('rejects productivity outside 1-200', function () {
  assert.strictEqual(calcDay({ startMin: 480, billedMin: 360, breakMin: 0, productivityPct: 0 }).ok, false);
  assert.strictEqual(calcDay({ startMin: 480, billedMin: 360, breakMin: 0, productivityPct: 201 }).ok, false);
  assert.strictEqual(calcDay({ startMin: 480, billedMin: 360, breakMin: 0, productivityPct: NaN }).ok, false);
});

check('rejects missing start time and negative breaks', function () {
  assert.strictEqual(calcDay({ startMin: NaN, billedMin: 360, breakMin: 0, productivityPct: 90 }).ok, false);
  assert.strictEqual(calcDay({ startMin: 480, billedMin: 360, breakMin: -10, productivityPct: 90 }).ok, false);
});

console.log('formatting & conversion');

check('fmtClock handles noon, midnight, AM/PM', function () {
  assert.strictEqual(fmtClock(0), '12:00 AM');
  assert.strictEqual(fmtClock(720), '12:00 PM');
  assert.strictEqual(fmtClock(990), '4:30 PM');
  assert.strictEqual(fmtClock(545), '9:05 AM');
});

check('fmtDuration pluralization-free formats', function () {
  assert.strictEqual(fmtDuration(30), '30 min');
  assert.strictEqual(fmtDuration(60), '1 hr');
  assert.strictEqual(fmtDuration(510), '8 hr 30 min');
  assert.strictEqual(fmtDuration(0), '0 min');
});

check('parseTimeValue parses HH:MM', function () {
  assert.strictEqual(parseTimeValue('08:00'), 480);
  assert.strictEqual(parseTimeValue('16:30'), 990);
  assert.ok(isNaN(parseTimeValue('')));
});

check('units <-> minutes round-trips to quarter units', function () {
  assert.strictEqual(unitsToMinutes(24), 360);
  assert.strictEqual(minutesToUnits(360), 24);
  assert.strictEqual(minutesToUnits(370), 24.75);          // 24.67 -> nearest 0.25
});

console.log('\n' + passed + ' tests passed');
