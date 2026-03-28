import { useState } from 'react';
import { COLORS, getSeverityColor } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { STRESS_EMOJI } from '../constants/labels';

export default function LogCard({ log, delay = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const severity = typeof log.parsed_severity === 'number' ? log.parsed_severity : null;
  const sevColor = getSeverityColor(severity ?? 0);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        ...STYLES.card,
        marginBottom: 10, cursor: 'pointer',
        transition: 'box-shadow 0.2s ease',
        animation: 'fadeSlideUp 0.4s ease both',
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted }}>{log.date}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: sevColor }}>{severity != null ? `${severity}/10` : '—'}</span>
          <span style={{ fontSize: 16 }}>{STRESS_EMOJI[log.parsed_stress] ?? ''}</span>
        </div>
      </div>

      {/* Severity strip */}
      <div style={{ height: 4, borderRadius: 999, backgroundColor: COLORS.surfaceAlt, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${severity != null ? severity * 10 : 0}%`, backgroundColor: sevColor, borderRadius: 999, transition: 'width 0.4s ease' }} />
      </div>

      {/* Food chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {(log.parsed_foods ?? []).map(f => (
          <span key={f} style={{ ...STYLES.chip, ...STYLES.chipOrange }}>{f}</span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted }}>Sleep: {log.parsed_sleep != null ? `${log.parsed_sleep}h` : '—'}</span>
        <span style={{ fontSize: 10, color: COLORS.mutedLight }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, animation: 'fadeSlideUp 0.2s ease' }}>
          <p style={{ fontSize: 13, color: COLORS.muted, fontStyle: 'italic', lineHeight: 1.5 }}>"{log.natural_summary}"</p>
        </div>
      )}
    </div>
  );
}
