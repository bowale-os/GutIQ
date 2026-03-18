import { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COLORS, getSeverityColor } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { createShareLink } from '../api/export';

const STRESS_LABEL = { high: 'High', medium: 'Moderate', low: 'Low' };

// ── Computations ──────────────────────────────────────────────────────────────

function computeStats(logs) {
  const last14   = logs.slice(0, 14);
  const withSev  = last14.filter(l => l.parsed_severity != null);
  const highDays = withSev.filter(l => l.parsed_severity >= 6);
  const avg      = withSev.length
    ? withSev.reduce((s, l) => s + l.parsed_severity, 0) / withSev.length : null;
  const sleepLogs = last14.filter(l => l.parsed_sleep != null);
  const avgSleep  = sleepLogs.length
    ? sleepLogs.reduce((s, l) => s + l.parsed_sleep, 0) / sleepLogs.length : null;
  return {
    avg, highDays: highDays.length, avgSleep,
    daysLogged: last14.length,
    compliance: Math.round((last14.length / 14) * 100),
  };
}

function detectPatterns(logs) {
  const last14  = logs.slice(0, 14);
  const withSev = last14.filter(l => l.parsed_severity != null);
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
      patterns.push({ strength: 'Strong', text: `${cap(food)} logged on all ${onHigh} high pain days (6 or above). Absent on ${lowDays.length - onLow} of ${lowDays.length} low pain days.` });
    } else if (highRate >= 0.6 && onHigh >= 2) {
      patterns.push({ strength: 'Moderate', text: `${cap(food)} appeared on ${onHigh} of ${highDays.length} high pain days.` });
    }
  }
  const lowSleepHigh = highDays.filter(l => l.parsed_sleep != null && l.parsed_sleep < 6).length;
  if (highDays.length >= 2 && lowSleepHigh >= 2)
    patterns.push({ strength: 'Moderate', text: `Sleep under 6h co-occurred with high pain days on ${lowSleepHigh} of ${highDays.length} occasions.` });

  const cleanDays = withSev.filter(l => l.parsed_severity <= 2 && !allFoods.slice(0, 3).some(f => (l.parsed_foods ?? []).includes(f)));
  if (cleanDays.length >= 2)
    patterns.push({ strength: 'Notable', text: `${cleanDays.length} logged days with no common triggers all had pain level ≤ 2.` });

  return patterns.slice(0, 4);
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function computeTrend(logs) {
  const today = new Date();
  const fmt   = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return [[0,3],[4,7],[8,11],[12,14]].map(([start, end]) => {
    const from = new Date(today); from.setDate(today.getDate() - end);
    const to   = new Date(today); to.setDate(today.getDate() - start);
    const days = [];
    for (let d = start; d < end; d++) {
      const day = new Date(today); day.setDate(today.getDate() - d);
      const label = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const match = logs.find(l => l.date === label);
      if (match?.parsed_severity != null) days.push(match.parsed_severity);
    }
    return { label: `${fmt(from)} – ${fmt(to)}`, avg: days.length ? days.reduce((s,v)=>s+v,0)/days.length : null };
  }).reverse();
}

function buildSummary(user, stats, patterns, trend) {
  const { avg, avgSleep, daysLogged, compliance } = stats;
  const vals = trend.filter(t => t.avg != null).map(t => t.avg);
  const trendDesc = vals.length >= 2
    ? vals[vals.length-1] - vals[0] > 1.5 ? `trending upward from ${vals[0].toFixed(1)} to ${vals[vals.length-1].toFixed(1)}`
    : vals[vals.length-1] - vals[0] < -1.5 ? `improving from ${vals[0].toFixed(1)} to ${vals[vals.length-1].toFixed(1)}`
    : 'broadly stable' : null;

  const p1 = `Over the 14-day period, ${user.name} logged on ${daysLogged} of 14 days.`
    + (trendDesc ? ` Pain level was ${trendDesc}.` : '')
    + (avg != null ? ` The overall mean pain level was ${avg.toFixed(1)} out of 10.` : '')
    + (avgSleep != null ? ` Average sleep was ${avgSleep.toFixed(1)} hours per night.` : '');
  const p2 = patterns[0]
    ? `${patterns[0].text}${patterns[1] ? ' ' + patterns[1].text : ''} These are patient-reported observations, not clinical findings.`
    : 'No strong dietary patterns were identified in the available data. These are patient-reported observations, not clinical findings.';
  return [p1, p2];
}

// ── PDF generation ────────────────────────────────────────────────────────────

function generatePDF({ user, stats, patterns, trend, summary, logs, generatedDate }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, margin = 18;

  let y = 0;

  // ── Header strip ──
  doc.setFillColor(28,25,23);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(250,250,249);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.text('GutIQ · Doctor Export', margin, 11);
  doc.text(`Generated ${generatedDate}`, W - margin, 11, { align: 'right' });
  doc.setFontSize(18);
  doc.setFont('helvetica','bold');
  doc.text(user.name, margin, 21);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.setTextColor(168,162,158);
  const cond = user.digestive_condition || user.condition || '';
  doc.text(`${cond}  ·  14-day summary`, W - margin, 21, { align: 'right' });

  y = 38;

  // ── Stat boxes ──
  const statW = (W - margin*2 - 9) / 4;
  const statData = [
    { label: 'AVG PAIN LEVEL', value: stats.avg != null ? `${stats.avg.toFixed(1)}/10` : '—', sub: '14-day mean' },
    { label: 'HIGH PAIN DAYS', value: String(stats.highDays), sub: 'pain level 6 or above' },
    { label: 'TRACKING',       value: `${stats.daysLogged}/14`, sub: 'days recorded' },
    { label: 'AVG SLEEP',      value: stats.avgSleep != null ? `${stats.avgSleep.toFixed(1)}h` : '—', sub: 'on logged days' },
  ];
  statData.forEach((s, i) => {
    const x = margin + i * (statW + 3);
    doc.setFillColor(245,241,235);
    doc.roundedRect(x, y, statW, 20, 2, 2, 'F');
    doc.setFontSize(6.5);
    doc.setFont('helvetica','bold');
    doc.setTextColor(120,113,108);
    doc.text(s.label, x + statW/2, y + 5.5, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica','bold');
    doc.setTextColor(28,25,23);
    doc.text(s.value, x + statW/2, y + 13, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica','normal');
    doc.setTextColor(120,113,108);
    doc.text(s.sub, x + statW/2, y + 17.5, { align: 'center' });
  });

  y += 28;

  // ── Observed Patterns ──
  if (patterns.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica','bold');
    doc.setTextColor(120,113,108);
    doc.text('OBSERVED PATTERNS', margin, y);
    y += 5;

    const strengthColor = { Strong: [201,106,43], Moderate: [217,119,6], Notable: [44,122,123] };
    patterns.forEach(p => {
      const [r,g,b] = strengthColor[p.strength] || [44,122,123];
      doc.setFillColor(r,g,b, 0.15);
      doc.setFillColor(r + Math.round((255-r)*0.82), g + Math.round((255-g)*0.82), b + Math.round((255-b)*0.82));
      doc.roundedRect(margin, y, 28, 5.5, 1.5, 1.5, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica','bold');
      doc.setTextColor(r,g,b);
      doc.text(p.strength, margin + 14, y + 3.8, { align: 'center' });
      doc.setFont('helvetica','normal');
      doc.setTextColor(28,25,23);
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(p.text, W - margin - 36);
      doc.text(lines, margin + 32, y + 3.8);
      y += Math.max(7, lines.length * 4.5);
    });
    y += 3;
  }

  // ── Pain Level Trend ──
  doc.setFontSize(7.5);
  doc.setFont('helvetica','bold');
  doc.setTextColor(120,113,108);
  doc.text('PAIN LEVEL TREND — LAST 14 DAYS', margin, y);
  y += 5;

  const barMaxW = W - margin*2 - 28;
  trend.forEach(t => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica','normal');
    doc.setTextColor(120,113,108);
    doc.text(t.label, margin, y + 3.5);
    doc.setFillColor(235,229,220);
    doc.roundedRect(margin + 26, y, barMaxW, 5, 1, 1, 'F');
    if (t.avg != null) {
      const pct = Math.min(t.avg / 10, 1);
      const barColor = t.avg <= 3 ? [44,122,123] : t.avg <= 6 ? [217,119,6] : [220,38,38];
      doc.setFillColor(...barColor);
      doc.roundedRect(margin + 26, y, barMaxW * pct, 5, 1, 1, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica','bold');
      doc.setTextColor(...barColor);
      doc.text(t.avg.toFixed(1), W - margin + 2, y + 3.8, { align: 'right' });
    } else {
      doc.setFontSize(7.5);
      doc.setFont('helvetica','normal');
      doc.setTextColor(168,162,158);
      doc.text('—', W - margin + 2, y + 3.8, { align: 'right' });
    }
    y += 8;
  });
  y += 3;

  // ── AI Summary ──
  doc.setFontSize(7.5);
  doc.setFont('helvetica','bold');
  doc.setTextColor(120,113,108);
  doc.text('AI-GENERATED SUMMARY', margin, y);
  y += 5;
  doc.setFillColor(245,241,235);
  const summaryText = summary.join(' ');
  const summaryLines = doc.splitTextToSize(summaryText, W - margin*2 - 8);
  const summaryH = summaryLines.length * 4.5 + 8;
  doc.roundedRect(margin, y, W - margin*2, summaryH, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica','normal');
  doc.setTextColor(41,37,36);
  doc.text(summaryLines, margin + 4, y + 6);
  y += summaryH + 6;

  // ── Full Log Table ──
  doc.setFontSize(7.5);
  doc.setFont('helvetica','bold');
  doc.setTextColor(120,113,108);
  doc.text('FULL LOG', margin, y);
  y += 3;

  const tableRows = logs.slice(0,14).map(l => [
    l.date ?? '—',
    l.parsed_severity != null ? `${l.parsed_severity}/10` : '—',
    (l.parsed_foods ?? []).join(', ') || '—',
    STRESS_LABEL[l.parsed_stress] ?? '—',
    l.parsed_sleep != null ? `${l.parsed_sleep}h` : '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['DATE','PAIN','FOODS','STRESS','SLEEP']],
    body: tableRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 3, textColor: [41,37,36], lineColor: [235,229,220], lineWidth: 0.3 },
    headStyles: { fillColor: [28,25,23], textColor: [168,162,158], fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: [245,241,235] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 22 },
      4: { cellWidth: 16, halign: 'center' },
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Disclaimer ──
  doc.setFontSize(6.5);
  doc.setFont('helvetica','italic');
  doc.setTextColor(120,113,108);
  const disclaimer = `This report was generated by GutIQ on ${generatedDate}. It is a patient self-log compiled by an AI assistant. It is not a medical record, clinical diagnosis, or professional assessment. Data reflects patient-reported entries only and has not been clinically verified. For informational use in a clinical consultation only.`;
  const dLines = doc.splitTextToSize(disclaimer, W - margin*2);
  doc.text(dLines, margin, y);

  doc.save(`GutIQ-Report-${user.name.replace(/\s+/g,'-')}-${generatedDate.replace(/\s/g,'')}.pdf`);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const STRENGTH_CHIP = {
  Strong:   { bg: COLORS.orangeLight,  color: COLORS.orange, border: `1px solid ${COLORS.orangeBorder}` },
  Moderate: { bg: COLORS.amberDim,     color: COLORS.amber,  border: `1px solid ${COLORS.amberBorder}` },
  Notable:  { bg: COLORS.tealLight,    color: COLORS.teal,   border: `1px solid ${COLORS.tealBorder}` },
};

function Section({ title, children, style }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <p style={{ ...STYLES.label, margin: '0 0 10px' }}>{title}</p>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, accentColor }) {
  return (
    <div style={{
      ...STYLES.cardSmall, flex: '1 1 60px', minWidth: 60,
      padding: '10px 8px 8px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'space-between', textAlign: 'center',
      minHeight: 80,
    }}>
      <p style={{ ...STYLES.label, fontSize: 8, letterSpacing: '0.06em', margin: 0 }}>{label}</p>
      <p style={{ margin: '6px 0', fontFamily: FONTS.mono, fontSize: 'clamp(14px, 4.5vw, 20px)', fontWeight: 700, color: accentColor || COLORS.text, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: 0, fontFamily: FONTS.mono, fontSize: 8, color: COLORS.mutedLight, lineHeight: 1.3 }}>{sub}</p>}
    </div>
  );
}

function PatternRow({ strength, text, last }) {
  const chip = STRENGTH_CHIP[strength] || STRENGTH_CHIP.Notable;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 0',
      borderBottom: last ? 'none' : `1px solid ${COLORS.border}`,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1, borderRadius: 20, padding: '2px 9px', fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600, backgroundColor: chip.bg, color: chip.color, border: chip.border }}>
        {strength}
      </span>
      <p style={{ margin: 0, fontSize: 13, color: COLORS.text, lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

function TrendBar({ label, avg }) {
  const pct   = avg != null ? Math.min((avg / 10) * 100, 100) : 0;
  const color = avg != null ? getSeverityColor(avg) : COLORS.mutedLight;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <p style={{ margin: 0, fontFamily: FONTS.mono, fontSize: 9, color: COLORS.muted, width: 'clamp(68px, 22vw, 88px)', flexShrink: 0 }}>{label}</p>
      <div style={{ flex: 1, height: 8, backgroundColor: COLORS.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
        {avg != null && <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 4, transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />}
      </div>
      <p style={{ margin: 0, fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color, width: 26, textAlign: 'right' }}>
        {avg != null ? avg.toFixed(1) : '—'}
      </p>
    </div>
  );
}

function SevBadge({ value }) {
  if (value == null) return <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight }}>—</span>;
  const color = getSeverityColor(value);
  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${color}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color }}>
      {value}
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function Export({ user, logs }) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing]         = useState(false);
  const [shareUrl, setShareUrl]       = useState(null);
  const [copied, setCopied]           = useState(false);
  const [shareError, setShareError]   = useState(null);

  const last14    = useMemo(() => logs.slice(0, 14), [logs]);
  const stats     = useMemo(() => computeStats(logs), [logs]);
  const patterns  = useMemo(() => detectPatterns(logs), [logs]);
  const trend     = useMemo(() => computeTrend(logs), [logs]);
  const summary   = useMemo(() => buildSummary(user, stats, patterns, trend), [user, stats, patterns, trend]);

  const generatedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateRange = last14.length ? `${last14[last14.length-1].date} – ${last14[0].date}` : 'No logs';

  const reportPayload = useMemo(() => ({
    user:  { name: user.name, condition: user.digestive_condition || user.condition },
    stats, patterns, summary,
    logs: last14.map(l => ({ date: l.date, severity: l.parsed_severity, foods: l.parsed_foods, stress: l.parsed_stress, sleep: l.parsed_sleep })),
  }), [user, stats, patterns, summary, last14]);

  const handleDownload = () => {
    setDownloading(true);
    try {
      generatePDF({ user, stats, patterns, trend, summary, logs: last14, generatedDate });
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    setShareError(null);
    try {
      const { url } = await createShareLink(reportPayload);
      setShareUrl(url);
    } catch (err) {
      setShareError(err.message ?? 'Could not generate link. Try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ ...STYLES.page, paddingBottom: 60 }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px' }}>

        {/* ── Header ── */}
        <div style={{ padding: '24px 0 20px', borderBottom: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
          <p style={{ ...STYLES.label, margin: '0 0 6px' }}>GutIQ · Doctor Export</p>
          <h1 style={{ ...STYLES.h1, fontSize: 'clamp(20px, 6vw, 26px)', margin: '0 0 4px' }}>{user.name}</h1>
          <p style={{ margin: 0, fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted }}>
            {user.digestive_condition || user.condition || 'Condition not set'} · {dateRange} · Generated {generatedDate}
          </p>
        </div>

        {/* ── Stats ── */}
        <Section title="Summary">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
            <StatCard label="AVG PAIN LEVEL" value={stats.avg != null ? `${stats.avg.toFixed(1)}/10` : '—'} sub="14-day mean" accentColor={stats.avg != null ? getSeverityColor(stats.avg) : undefined} />
            <StatCard label="HIGH PAIN DAYS" value={stats.highDays} sub="pain level 6 or above" accentColor={stats.highDays > 0 ? COLORS.danger : undefined} />
            <StatCard label="TRACKING"       value={`${stats.daysLogged}/14`} sub="days recorded" />
            <StatCard label="AVG SLEEP"      value={stats.avgSleep != null ? `${stats.avgSleep.toFixed(1)}h` : '—'} sub="on logged days" />
          </div>
        </Section>

        {/* ── Patterns ── */}
        <Section title="Observed Patterns">
          <div style={{ ...STYLES.card, padding: '4px 16px' }}>
            {patterns.length === 0
              ? <p style={{ padding: '12px 0', fontSize: 13, color: COLORS.muted }}>Not enough data to identify patterns yet.</p>
              : patterns.map((p, i) => <PatternRow key={i} {...p} last={i === patterns.length - 1} />)
            }
          </div>
        </Section>

        {/* ── Trend ── */}
        <Section title="Pain Level Trend — Last 14 Days">
          <div style={{ ...STYLES.card, padding: '14px 16px' }}>
            {trend.map((t, i) => <TrendBar key={i} label={t.label} avg={t.avg} />)}
          </div>
        </Section>

        {/* ── AI Summary ── */}
        <Section title="AI-Generated Summary">
          <div style={{ ...STYLES.card, padding: '16px 18px', backgroundColor: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}` }}>
            {summary.map((para, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0', fontSize: 13, color: COLORS.textSoft, lineHeight: 1.75 }}>{para}</p>
            ))}
          </div>
        </Section>

        {/* ── Full Log ── */}
        <Section title="Full Log">
          <div style={{ ...STYLES.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                <thead>
                  <tr style={{ backgroundColor: COLORS.surfaceAlt }}>
                    {['Date','Pain','Foods','Stress','Sleep'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontFamily: FONTS.mono, fontSize: 9, color: COLORS.muted, letterSpacing: '0.07em', fontWeight: 600, borderBottom: `1px solid ${COLORS.border}` }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {last14.length === 0
                    ? <tr><td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>No logs yet.</td></tr>
                    : last14.map((log, i) => (
                      <tr key={log.id ?? `${log.date}-${i}`} style={{ borderBottom: i < last14.length - 1 ? `1px solid ${COLORS.border}` : 'none', backgroundColor: i % 2 === 0 ? 'transparent' : COLORS.surfaceAlt }}>
                        <td style={{ padding: '9px 14px', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted, whiteSpace: 'nowrap' }}>{log.date}</td>
                        <td style={{ padding: '9px 14px' }}><SevBadge value={log.parsed_severity} /></td>
                        <td style={{ padding: '9px 14px', fontSize: 12, color: COLORS.text, maxWidth: 160 }}>
                          {(log.parsed_foods ?? []).join(', ') || <span style={{ color: COLORS.mutedLight, fontStyle: 'italic' }}>No entry</span>}
                        </td>
                        <td style={{ padding: '9px 14px', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted }}>{STRESS_LABEL[log.parsed_stress] ?? '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted }}>{log.parsed_sleep != null ? `${log.parsed_sleep}h` : '—'}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* ── Share with doctor ── */}
        <Section title="Share with Doctor">
          <div style={{ ...STYLES.card, padding: '16px 18px' }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: COLORS.muted, lineHeight: 1.55 }}>
              Generate a secure link your doctor can open on any device. Expires after 7 days.
            </p>
            {!shareUrl ? (
              <>
                {shareError && <p style={{ margin: '0 0 10px', fontSize: 12, color: COLORS.danger }}>{shareError}</p>}
                <button
                  onClick={handleShare} disabled={sharing}
                  style={{ ...STYLES.btnGhost, width: 'auto', padding: '10px 18px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: sharing ? 0.6 : 1 }}
                >
                  {sharing ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.muted, animation: 'spin 0.7s linear infinite' }} />Generating...</> : '🔗  Generate share link'}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, backgroundColor: COLORS.surfaceAlt, borderRadius: 8, border: `1px solid ${COLORS.border}`, padding: '9px 12px' }}>
                  <p style={{ flex: 1, margin: 0, fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareUrl}</p>
                  <button onClick={handleCopy} style={{ flexShrink: 0, background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 11, color: copied ? COLORS.teal : COLORS.muted }}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ padding: 14, backgroundColor: '#fff', borderRadius: 10, border: `1px solid ${COLORS.border}`, display: 'inline-block' }}>
                    <QRCodeSVG value={shareUrl} size={140} fgColor={COLORS.text} bgColor="#ffffff" />
                  </div>
                  <p style={{ margin: 0, fontFamily: FONTS.mono, fontSize: 10, color: COLORS.mutedLight }}>Doctor can scan this to open the report</p>
                </div>
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <button onClick={() => { setShareUrl(null); setShareError(null); setCopied(false); }} style={{ background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted, padding: '5px 12px' }}>
                    Generate a new link
                  </button>
                  <p style={{ margin: '6px 0 0', fontFamily: FONTS.mono, fontSize: 10, color: COLORS.mutedLight }}>
                    The previous link stays active until it expires in 7 days.
                  </p>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* ── Disclaimer ── */}
        <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.7, fontStyle: 'italic', padding: '12px 14px', marginBottom: 20, backgroundColor: COLORS.surfaceAlt, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
          This report was generated by GutIQ on {generatedDate}. It is a patient self-log compiled by an AI assistant. It is not a medical record, clinical diagnosis, or professional assessment. Data reflects patient-reported entries only and has not been clinically verified. For informational use in a clinical consultation only.
        </p>

        {/* ── Download PDF ── */}
        <button
          onClick={handleDownload} disabled={downloading}
          style={{ ...STYLES.btnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: downloading ? 0.7 : 1 }}
        >
          {downloading
            ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />Generating PDF...</>
            : '↓  Download PDF'
          }
        </button>

      </div>
    </div>
  );
}
