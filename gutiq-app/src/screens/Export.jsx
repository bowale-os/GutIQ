import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';

const getSeverityColor = (v) => v <= 3 ? COLORS.teal : v <= 6 ? COLORS.amber : COLORS.danger;
const stressEmoji = { high: '😰', medium: '😐', low: '😌' };

function computeStats(logs) {
  const avg      = (logs.reduce((s, l) => s + l.parsed_severity, 0) / logs.length).toFixed(1);
  const highDays = logs.filter(l => l.parsed_severity >= 6).length;
  const avgSleep = (logs.reduce((s, l) => s + l.parsed_sleep, 0) / logs.length).toFixed(1);
  const foodCounts = {};
  logs.forEach(l => l.parsed_foods.forEach(f => { foodCounts[f] = (foodCounts[f] || 0) + 1; }));
  const topTrigger = Object.entries(foodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  return { avg, highDays, avgSleep, topTrigger };
}

function StatPill({ label, value, orange }) {
  return (
    <div style={{
      ...STYLES.card,
      textAlign: 'center', minWidth: 88,
      border: orange ? `1px solid ${COLORS.orangeBorder}` : `1px solid ${COLORS.border}`,
    }}>
      <p style={{ ...STYLES.label, marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: FONTS.mono, fontSize: 20, fontWeight: 500, color: orange ? COLORS.orange : COLORS.text }}>{value}</p>
    </div>
  );
}

export default function Export({ user, logs, navigate }) {
  const [downloading, setDownloading] = useState(false);
  const { avg, highDays, avgSleep, topTrigger } = computeStats(logs);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => { setDownloading(false); alert('In a full build, this would generate a PDF to share with your doctor.'); }, 1500);
  };

  return (
    <div style={{ ...STYLES.page, paddingBottom: 90 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 0' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ ...STYLES.label, marginBottom: 6 }}>Doctor export</p>
          <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 6 }}>14-Day Summary</h1>
          <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted }}>
            {user.name} · {user.condition} · Last 14 days
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <StatPill label="Avg severity" value={`${avg}/10`} orange />
          <StatPill label="High days"    value={`${highDays}`} />
          <StatPill label="Top trigger"  value={topTrigger} />
          <StatPill label="Avg sleep"    value={`${avgSleep}h`} />
        </div>

        {/* Table */}
        <div style={{ ...STYLES.card, padding: '4px 0', marginBottom: 16, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {['Date', 'Sev', 'Foods', 'Stress', 'Sleep'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted, letterSpacing: '0.07em', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.date} style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  borderLeft: log.parsed_severity >= 6 ? `3px solid ${COLORS.danger}` : '3px solid transparent',
                  backgroundColor: i % 2 === 0 ? 'transparent' : COLORS.surfaceAlt,
                  animation: 'fadeSlideUp 0.3s ease both',
                  animationDelay: `${i * 20}ms`,
                }}>
                  <td style={{ padding: '10px 14px', fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted, whiteSpace: 'nowrap' }}>{log.date}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 500, color: getSeverityColor(log.parsed_severity) }}>{log.parsed_severity}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: COLORS.muted, maxWidth: 140 }}>{log.parsed_foods.join(', ')}</td>
                  <td style={{ padding: '10px 14px', fontSize: 16 }}>{stressEmoji[log.parsed_stress]}</td>
                  <td style={{ padding: '10px 14px', fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted, whiteSpace: 'nowrap' }}>{log.parsed_sleep}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Text summary */}
        <div style={{ ...STYLES.card, background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.orangeLight} 100%)`, border: `1px solid ${COLORS.orangeBorder}`, marginBottom: 16 }}>
          <p style={{ ...STYLES.labelTeal, marginBottom: 10 }}>Summary for doctor</p>
          <p style={{ fontSize: 14, color: COLORS.textSoft, lineHeight: 1.7 }}>
            Over the last 14 days, <strong>{user.name}</strong> ({user.condition}) logged consistently.
            Average symptom severity was <strong style={{ color: COLORS.amber }}>{avg}/10</strong>.
            High-symptom days (≥6) occurred on <strong style={{ color: COLORS.danger }}>{highDays} of 14 days</strong>.
            Top dietary trigger: <strong style={{ color: COLORS.orange }}>{topTrigger}</strong>.
            Average sleep was <strong>{avgSleep} hours</strong> per night.
          </p>
        </div>

        {/* Legal disclaimer */}
        <div style={{ backgroundColor: COLORS.dangerDim, border: `1px solid ${COLORS.dangerBorder}`, borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: COLORS.muted, fontStyle: 'italic', lineHeight: 1.6 }}>
            This is a patient self-log generated by GutIQ. It is not a medical record, clinical report, or diagnosis. For informational use only.
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{ ...STYLES.btnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: downloading ? 0.7 : 1 }}
        >
          {downloading
            ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> Preparing PDF...</>
            : '⬇  Download PDF summary'
          }
        </button>

      </div>
    </div>
  );
}
