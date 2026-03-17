// utils/exportStats.js
// Pure computation functions for the doctor export report.
// No React, no side effects — takes raw log arrays, returns plain objects.

export const STRESS_LABEL = { high: 'High', medium: 'Moderate', low: 'Low' };

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function computeStats(logs) {
  const last14    = logs.slice(0, 14);
  const withSev   = last14.filter(l => l.parsed_severity != null);
  const highDays  = withSev.filter(l => l.parsed_severity >= 6);
  const avg       = withSev.length
    ? withSev.reduce((s, l) => s + l.parsed_severity, 0) / withSev.length : null;
  const sleepLogs = last14.filter(l => l.parsed_sleep != null);
  const avgSleep  = sleepLogs.length
    ? sleepLogs.reduce((s, l) => s + l.parsed_sleep, 0) / sleepLogs.length : null;
  return {
    avg,
    highDays:   highDays.length,
    avgSleep,
    daysLogged: last14.length,
    compliance: Math.round((last14.length / 14) * 100),
  };
}

export function detectPatterns(logs) {
  const last14   = logs.slice(0, 14);
  const withSev  = last14.filter(l => l.parsed_severity != null);
  if (withSev.length < 3) return [];

  const highDays = withSev.filter(l => l.parsed_severity >= 6);
  const lowDays  = withSev.filter(l => l.parsed_severity < 6);
  const allFoods = [...new Set(last14.flatMap(l => l.parsed_foods ?? []))];
  const patterns = [];

  for (const food of allFoods) {
    const onHigh   = highDays.filter(l => (l.parsed_foods ?? []).includes(food)).length;
    const onLow    = lowDays.filter(l => (l.parsed_foods ?? []).includes(food)).length;
    if (!highDays.length) continue;
    const highRate = onHigh / highDays.length;
    const lowRate  = lowDays.length ? onLow / lowDays.length : 0;

    if (highRate >= 0.9 && onHigh >= 2 && lowRate <= 0.25) {
      patterns.push({
        strength: 'Strong',
        _food: food,
        text: `${cap(food)} logged on all ${onHigh} high pain days (≥6). Absent on ${lowDays.length - onLow} of ${lowDays.length} low pain days.`,
      });
    } else if (highRate >= 0.6 && onHigh >= 2) {
      patterns.push({
        strength: 'Moderate',
        _food: food,
        text: `${cap(food)} appeared on ${onHigh} of ${highDays.length} high pain days.`,
      });
    }
  }

  const lowSleepHigh = highDays.filter(l => l.parsed_sleep != null && l.parsed_sleep < 6).length;
  if (highDays.length >= 2 && lowSleepHigh >= 2) {
    patterns.push({
      strength: 'Moderate',
      text: `Sleep under 6h co-occurred with high pain days on ${lowSleepHigh} of ${highDays.length} occasions.`,
    });
  }

  // Use foods already identified as correlated triggers (Strong/Moderate patterns).
  // Falling back to frequency-ranked foods if no trigger patterns exist yet.
  // Never use iteration-order slice — that would produce clinically meaningless output.
  const triggerFoods = patterns
    .filter(p => p.strength === 'Strong' || p.strength === 'Moderate')
    .map(p => p._food)
    .filter(Boolean);

  const referenceFoods = triggerFoods.length > 0
    ? triggerFoods
    : [...allFoods].sort(
        (a, b) =>
          last14.filter(l => (l.parsed_foods ?? []).includes(b)).length -
          last14.filter(l => (l.parsed_foods ?? []).includes(a)).length
      ).slice(0, 3);

  const cleanDays = withSev.filter(
    l => l.parsed_severity <= 2 && !referenceFoods.some(f => (l.parsed_foods ?? []).includes(f))
  );
  if (cleanDays.length >= 2) {
    patterns.push({
      strength: 'Notable',
      text: `${cleanDays.length} logged days with no common triggers all had pain level ≤ 2.`,
    });
  }

  // Strip internal bookkeeping field before returning to callers.
  return patterns.slice(0, 4).map(({ _food: _, ...p }) => p);
}

export function computeTrend(logs) {
  const today = new Date();
  const fmt   = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return [[0, 3], [4, 7], [8, 11], [12, 13]].map(([start, end]) => {
    const from = new Date(today); from.setDate(today.getDate() - end);
    const to   = new Date(today); to.setDate(today.getDate() - start);
    const days = [];
    for (let d = start; d <= end; d++) {
      const day = new Date(today); day.setDate(today.getDate() - d);
      const label = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const match = logs.find(l => l.date === label);
      if (match?.parsed_severity != null) days.push(match.parsed_severity);
    }
    return {
      label: `${fmt(from)} – ${fmt(to)}`,
      avg:   days.length ? days.reduce((s, v) => s + v, 0) / days.length : null,
    };
  }).reverse();
}

export function buildSummary(user, stats, patterns, trend) {
  const { avg, avgSleep, daysLogged } = stats;
  const vals = trend.filter(t => t.avg != null).map(t => t.avg);

  const trendDesc = vals.length >= 2
    ? vals[vals.length - 1] - vals[0] > 1.5
      ? `trending upward from ${vals[0].toFixed(1)} to ${vals[vals.length - 1].toFixed(1)}`
      : vals[vals.length - 1] - vals[0] < -1.5
        ? `improving from ${vals[0].toFixed(1)} to ${vals[vals.length - 1].toFixed(1)}`
        : 'broadly stable'
    : null;

  const p1 =
    `Over the 14-day period, ${user.name} logged on ${daysLogged} of 14 days.` +
    (trendDesc ? ` Pain level was ${trendDesc}.` : '') +
    (avg != null ? ` The overall mean pain level was ${avg.toFixed(1)} out of 10.` : '') +
    (avgSleep != null ? ` Average sleep was ${avgSleep.toFixed(1)} hours per night.` : '');

  const p2 = patterns[0]
    ? `${patterns[0].text}${patterns[1] ? ' ' + patterns[1].text : ''} These are patient-reported observations, not clinical findings.`
    : 'No strong dietary patterns were identified in the available data. These are patient-reported observations, not clinical findings.';

  return [p1, p2];
}
