// src/screens/SharedReport.jsx
// Public view of a shared doctor export — no auth required.
// Fetches the report snapshot from GET /export/report/:token and renders it.

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { COLORS, getSeverityColor } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { BASE } from '../api/client';

const STRESS_LABEL = { high: 'High', medium: 'Moderate', low: 'Low' };

const STRENGTH_CHIP = {
  Strong:   { backgroundColor: COLORS.orangeLight,  color: COLORS.orange, border: `1px solid ${COLORS.orangeBorder}` },
  Moderate: { backgroundColor: COLORS.amberDim,     color: COLORS.amber,  border: `1px solid ${COLORS.amberBorder}` },
  Notable:  { backgroundColor: COLORS.tealLight,    color: COLORS.teal,   border: `1px solid ${COLORS.tealBorder}` },
};

function SevBadge({ value }) {
  if (value == null) return <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight }}>—</span>;
  const color = getSeverityColor(value);
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      border: `1.5px solid ${color}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color,
    }}>
      {value}
    </div>
  );
}

export default function SharedReport({ token }) {
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch(`${BASE}/export/report/${token}`)
      .then(res => {
        if (res.status === 404) throw new Error('Report not found. The link may be invalid.');
        if (res.status === 410) throw new Error('This report link has expired (links are valid for 7 days).');
        if (!res.ok) throw new Error(`Could not load report (${res.status}).`);
        return res.json();
      })
      .then(setReport)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ ...STYLES.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.orange, animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted }}>Loading report...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...STYLES.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: 360, textAlign: 'center', padding: '0 24px' }}>
        <p style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 8 }}>Report unavailable</p>
        <p style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6 }}>{error}</p>
      </div>
    </div>
  );

  const { user, stats, patterns, summary, logs } = report;
  const generatedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const shareUrl = window.location.href;

  return (
    <div style={{ ...STYLES.page, paddingBottom: 60 }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 20px' }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 0 16px', borderBottom: `1px solid ${COLORS.border}`, marginBottom: 20,
        }}>
          <p style={{ ...STYLES.label, margin: 0 }}>GutIQ · Doctor export</p>
          <p style={{ margin: 0, fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted }}>Viewed {generatedDate}</p>
        </div>

        {/* Patient header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 4 }}>{user.name}</h1>
          <p style={{ margin: 0, fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted }}>
            {user.condition || 'Condition not set'} · 14-day summary
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Avg Pain Level', value: stats.avg != null ? `${Number(stats.avg).toFixed(1)}/10` : '—', sub: '14-day mean', accent: stats.avg != null ? getSeverityColor(stats.avg) : undefined },
            { label: 'High Days',      value: stats.highDays, sub: 'pain level ≥ 6', accent: stats.highDays > 0 ? COLORS.danger : undefined },
            { label: 'Days Logged',  value: `${stats.daysLogged}/14`, sub: `${stats.compliance}% compliance` },
            { label: 'Avg Sleep',    value: stats.avgSleep != null ? `${Number(stats.avgSleep).toFixed(1)}h` : '—', sub: 'on logged days' },
          ].map(c => (
            <div key={c.label} style={{ ...STYLES.cardSmall, flex: 1, minWidth: 80, textAlign: 'center' }}>
              <p style={{ ...STYLES.label, marginBottom: 8 }}>{c.label}</p>
              <p style={{ margin: 0, fontFamily: FONTS.mono, fontSize: 20, fontWeight: 600, color: c.accent || COLORS.text, lineHeight: 1 }}>{c.value}</p>
              {c.sub && <p style={{ margin: '4px 0 0', fontFamily: FONTS.mono, fontSize: 10, color: COLORS.mutedLight }}>{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* Patterns */}
        {patterns?.length > 0 && (
          <div style={{ ...STYLES.card, padding: '16px 18px', marginBottom: 16 }}>
            <p style={{ ...STYLES.label, margin: '0 0 4px' }}>Observed Patterns</p>
            <div style={{ marginTop: 4 }}>
              {patterns.map((p, i) => {
                const chip = STRENGTH_CHIP[p.strength] || STRENGTH_CHIP.Notable;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                    <span style={{ flexShrink: 0, marginTop: 1, borderRadius: 20, padding: '2px 9px', fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600, ...chip }}>
                      {p.strength}
                    </span>
                    <p style={{ margin: 0, fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>{p.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        {summary?.length > 0 && (
          <div style={{ ...STYLES.card, padding: '16px 18px', marginBottom: 16 }}>
            <p style={{ ...STYLES.label, margin: '0 0 12px' }}>AI-Generated Summary</p>
            {summary.map((para, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0', fontSize: 13, color: COLORS.textSoft, lineHeight: 1.7 }}>{para}</p>
            ))}
          </div>
        )}

        {/* Full log table */}
        <div style={{ ...STYLES.card, padding: 0, marginBottom: 16, overflow: 'hidden' }}>
          <p style={{ ...STYLES.label, margin: 0, padding: '14px 18px 12px', borderBottom: `1px solid ${COLORS.border}` }}>
            Full Log
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
              <thead>
                <tr>
                  {['Date', 'Sev.', 'Foods', 'Stress', 'Sleep'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontFamily: FONTS.mono, fontSize: 9, color: COLORS.muted, letterSpacing: '0.07em', fontWeight: 500, borderBottom: `1px solid ${COLORS.border}` }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map((log, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: i % 2 === 0 ? 'transparent' : COLORS.surfaceAlt }}>
                    <td style={{ padding: '10px 14px', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted, whiteSpace: 'nowrap' }}>{log.date}</td>
                    <td style={{ padding: '10px 14px' }}><SevBadge value={log.severity} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: COLORS.text, maxWidth: 160 }}>
                      {(log.foods ?? []).join(', ') || <span style={{ color: COLORS.mutedLight, fontStyle: 'italic' }}>No entry</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted }}>{STRESS_LABEL[log.stress] ?? '—'}</td>
                    <td style={{ padding: '10px 14px', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted }}>{log.sleep != null ? `${log.sleep}h` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* QR for easy resharing */}
        <div style={{ ...STYLES.card, padding: '16px 18px', marginBottom: 16, textAlign: 'center' }}>
          <p style={{ ...STYLES.label, margin: '0 0 12px' }}>Share this report</p>
          <div style={{ display: 'inline-block', padding: 12, backgroundColor: '#fff', borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
            <QRCodeSVG value={shareUrl} size={120} fgColor={COLORS.text} bgColor="#ffffff" />
          </div>
          <p style={{ margin: '8px 0 0', fontFamily: FONTS.mono, fontSize: 10, color: COLORS.mutedLight }}>
            Scan to open on another device
          </p>
        </div>

        {/* Disclaimer */}
        <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.7, fontStyle: 'italic', padding: '12px 14px', backgroundColor: COLORS.surfaceAlt, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
          This report is a patient self-log compiled by GutIQ. It is not a medical record, clinical diagnosis, or professional assessment. Data reflects patient-reported entries only and has not been clinically verified. For informational use in a clinical consultation only.
        </p>

      </div>
    </div>
  );
}
