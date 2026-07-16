/* TheraClock — productivity day planner for PT / OT / PTA / COTA.
   Core idea: productivity % = billed time ÷ working time, and breaks don't
   count against you. So:
     working time = billed ÷ (productivity/100)
     clock-out    = start + working time + breaks
*/

'use strict';

var UNIT_MINUTES = 15;

/* ---------------- pure calculation (unit-tested in test/calc.test.js) ---------------- */

function calcDay(input) {
  var startMin = input.startMin;
  var billedMin = input.billedMin;
  var breakMin = input.breakMin;
  var productivityPct = input.productivityPct;

  if (!isFinite(startMin) || startMin < 0 || startMin >= 1440) {
    return { ok: false, reason: 'Enter your start time.' };
  }
  if (!isFinite(billedMin) || billedMin <= 0) {
    return { ok: false, reason: 'Enter your expected billed time.' };
  }
  if (!isFinite(breakMin) || breakMin < 0) {
    return { ok: false, reason: 'Break time can’t be negative.' };
  }
  if (!isFinite(productivityPct) || productivityPct <= 0 || productivityPct > 200) {
    return { ok: false, reason: 'Productivity must be between 1% and 200%.' };
  }

  var workedMin = billedMin / (productivityPct / 100);
  var totalMin = workedMin + breakMin;
  var endAbs = Math.round(startMin + totalMin);

  return {
    ok: true,
    workedMin: workedMin,
    nonBillableMin: Math.max(0, workedMin - billedMin),
    totalMin: totalMin,
    endMinOfDay: ((endAbs % 1440) + 1440) % 1440,
    dayOffset: Math.floor(endAbs / 1440)
  };
}

function fmtDuration(min) {
  var m = Math.round(min);
  var h = Math.floor(m / 60);
  var r = m % 60;
  if (h === 0) return r + ' min';
  if (r === 0) return h + ' hr';
  return h + ' hr ' + r + ' min';
}

function fmtClock(minOfDay) {
  var h = Math.floor(minOfDay / 60);
  var m = Math.round(minOfDay % 60);
  var ap = h < 12 ? 'AM' : 'PM';
  h = h % 12;
  if (h === 0) h = 12;
  return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
}

function parseTimeValue(v) {
  if (!v || v.indexOf(':') === -1) return NaN;
  var parts = v.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function unitsToMinutes(units) { return units * UNIT_MINUTES; }
function minutesToUnits(min) { return Math.round((min / UNIT_MINUTES) * 4) / 4; }

/* ---------------- DOM wiring (skipped when required from Node for tests) ---------------- */

if (typeof document !== 'undefined') {
  (function () {
    var $ = function (id) { return document.getElementById(id); };

    var els = {
      start: $('start'),
      modeUnits: $('mode-units'),
      modeHours: $('mode-hours'),
      paneUnits: $('pane-units'),
      paneHours: $('pane-hours'),
      units: $('units'),
      unitsMinus: $('units-minus'),
      unitsPlus: $('units-plus'),
      unitsHint: $('units-hint'),
      billH: $('bill-h'),
      billM: $('bill-m'),
      brk: $('break'),
      breakChips: $('break-chips'),
      prod: $('prod'),
      prodChips: $('prod-chips'),
      endTime: $('end-time'),
      endNote: $('end-note'),
      worked: $('worked'),
      nonbill: $('nonbill'),
      segBilled: $('seg-billed'),
      segNonbill: $('seg-nonbill'),
      segBreak: $('seg-break'),
      lgBilled: $('lg-billed'),
      lgNonbill: $('lg-nonbill'),
      lgBreak: $('lg-break'),
      mathLine: $('math-line'),
      warn: $('warn')
    };

    var STORAGE_KEY = 'theraclock:v1';

    function currentMode() {
      return els.modeHours.checked ? 'hours' : 'units';
    }

    function billedMinutes() {
      if (currentMode() === 'units') {
        return unitsToMinutes(Number(els.units.value));
      }
      return Number(els.billH.value || 0) * 60 + Number(els.billM.value || 0);
    }

    function fmtPct(p) {
      return (Math.round(p * 10) / 10) + '%';
    }

    function syncChips(container, value) {
      var buttons = container.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        b.classList.toggle('active', Number(b.dataset.value) === value);
      }
    }

    function saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          start: els.start.value,
          mode: currentMode(),
          units: els.units.value,
          billH: els.billH.value,
          billM: els.billM.value,
          brk: els.brk.value,
          prod: els.prod.value
        }));
      } catch (e) { /* private mode etc. — persistence is a nicety, not a need */ }
    }

    function loadState() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        var s = JSON.parse(raw);
        if (s.start) els.start.value = s.start;
        if (s.units != null) els.units.value = s.units;
        if (s.billH != null) els.billH.value = s.billH;
        if (s.billM != null) els.billM.value = s.billM;
        if (s.brk != null) els.brk.value = s.brk;
        if (s.prod != null) els.prod.value = s.prod;
        if (s.mode === 'hours') { els.modeHours.checked = true; }
      } catch (e) { /* corrupted state — fall back to defaults */ }
    }

    function syncModePanes() {
      var units = currentMode() === 'units';
      els.paneUnits.hidden = !units;
      els.paneHours.hidden = units;
    }

    function update() {
      var billed = billedMinutes();
      var brk = Number(els.brk.value);
      var prod = Number(els.prod.value);
      var res = calcDay({
        startMin: parseTimeValue(els.start.value),
        billedMin: billed,
        breakMin: brk,
        productivityPct: prod
      });

      // units hint
      var u = Number(els.units.value);
      els.unitsHint.textContent = isFinite(u) && u > 0
        ? u + (u === 1 ? ' unit = ' : ' units = ') + fmtDuration(unitsToMinutes(u))
        : ' ';

      syncChips(els.breakChips, brk);
      syncChips(els.prodChips, prod);

      if (!res.ok) {
        els.endTime.textContent = '—';
        els.endNote.textContent = res.reason;
        els.worked.textContent = '—';
        els.nonbill.textContent = '—';
        els.lgBilled.textContent = '—';
        els.lgNonbill.textContent = '—';
        els.lgBreak.textContent = '—';
        els.segBilled.hidden = true;
        els.segNonbill.hidden = true;
        els.segBreak.hidden = true;
        els.mathLine.textContent = '';
        els.warn.hidden = true;
        saveState();
        return;
      }

      els.endTime.textContent = fmtClock(res.endMinOfDay);
      if (res.dayOffset >= 1) {
        var sup = document.createElement('span');
        sup.className = 'plus-day';
        sup.textContent = '+' + res.dayOffset + ' day' + (res.dayOffset > 1 ? 's' : '');
        els.endTime.appendChild(sup);
      }
      els.endNote.textContent = fmtDuration(res.totalMin) + ' door to door';

      els.worked.textContent = fmtDuration(res.workedMin);
      els.nonbill.textContent = fmtDuration(res.nonBillableMin);

      // breakdown bar — billed segment is capped at working time so the
      // composition always sums to the actual day (matters when productivity > 100%)
      var billedShown = Math.min(billed, res.workedMin);
      var parts = [
        [els.segBilled, billedShown],
        [els.segNonbill, res.nonBillableMin],
        [els.segBreak, brk]
      ];
      for (var i = 0; i < parts.length; i++) {
        var el = parts[i][0];
        var val = parts[i][1];
        var show = val / res.totalMin > 0.004;
        el.hidden = !show;
        if (show) el.style.flexGrow = String(val / res.totalMin);
      }
      els.lgBilled.textContent = fmtDuration(billed);
      els.lgNonbill.textContent = fmtDuration(res.nonBillableMin);
      els.lgBreak.textContent = brk > 0 ? fmtDuration(brk) : 'none';

      els.mathLine.textContent =
        fmtDuration(billed) + ' billed ÷ ' + fmtPct(prod) + ' = ' +
        fmtDuration(res.workedMin) + ' working' +
        (brk > 0 ? ' · + ' + fmtDuration(brk) + ' break' : '') +
        ' → out at ' + fmtClock(res.endMinOfDay);

      var warnings = [];
      if (prod > 100) {
        warnings.push('Over 100% productivity means billing more time than you work (concurrent or group treatment) — double-check that target.');
      }
      if (res.totalMin > 16 * 60) {
        warnings.push('That’s a ' + fmtDuration(res.totalMin) + ' day — you may want to check your numbers.');
      }
      els.warn.hidden = warnings.length === 0;
      els.warn.textContent = warnings.join(' ');

      saveState();
    }

    function stepUnits(delta) {
      var v = Number(els.units.value);
      if (!isFinite(v)) v = 0;
      v = Math.min(99, Math.max(0, v + delta));
      els.units.value = String(v);
      update();
    }

    function convertOnModeSwitch() {
      // keep the same billed time when flipping representation
      if (currentMode() === 'hours') {
        var min = unitsToMinutes(Number(els.units.value) || 0);
        els.billH.value = String(Math.floor(min / 60));
        els.billM.value = String(Math.round(min % 60));
      } else {
        var m = Number(els.billH.value || 0) * 60 + Number(els.billM.value || 0);
        els.units.value = String(minutesToUnits(m));
      }
      syncModePanes();
      update();
    }

    // events
    var liveInputs = [els.start, els.units, els.billH, els.billM, els.brk, els.prod];
    for (var i = 0; i < liveInputs.length; i++) {
      liveInputs[i].addEventListener('input', update);
    }
    els.modeUnits.addEventListener('change', convertOnModeSwitch);
    els.modeHours.addEventListener('change', convertOnModeSwitch);
    els.unitsMinus.addEventListener('click', function () { stepUnits(-1); });
    els.unitsPlus.addEventListener('click', function () { stepUnits(1); });

    function chipHandler(input) {
      return function (ev) {
        var btn = ev.target.closest('button');
        if (!btn) return;
        input.value = btn.dataset.value;
        update();
      };
    }
    els.breakChips.addEventListener('click', chipHandler(els.brk));
    els.prodChips.addEventListener('click', chipHandler(els.prod));

    // boot
    loadState();
    syncModePanes();
    update();

    // offline support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () {
          /* offline install is progressive enhancement */
        });
      });
    }
  })();
}

/* node test hook */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcDay: calcDay,
    fmtDuration: fmtDuration,
    fmtClock: fmtClock,
    parseTimeValue: parseTimeValue,
    unitsToMinutes: unitsToMinutes,
    minutesToUnits: minutesToUnits,
    UNIT_MINUTES: UNIT_MINUTES
  };
}
