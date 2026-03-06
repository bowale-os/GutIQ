import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';

const TAG_STYLES = {
  accent: { bg: COLORS.tealLight,   text: COLORS.teal,   border: COLORS.tealBorder },
  danger: { bg: COLORS.dangerDim,   text: COLORS.danger, border: COLORS.dangerBorder },
  amber:  { bg: COLORS.amberDim,    text: COLORS.amber,  border: COLORS.amberBorder },
};

export default function InsightCard({ insight, delay = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const tag = TAG_STYLES[insight.tagColor] || TAG_STYLES.accent;
  const confColor = insight.confidence >= 80 ? COLORS.teal : insight.confidence >= 60 ? COLORS.amber : COLORS.muted;

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        ...STYLES.card,
        marginBottom: 12, cursor: 'pointer',
        border: expanded ? `1px solid ${COLORS.orangeBorder}` : `1px solid ${COLORS.border}`,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: expanded ? COLORS.shadowMd : COLORS.shadow,
        animation: 'fadeSlideUp 0.4s ease both',
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{insight.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <h3 style={{ ...STYLES.h3, fontSize: 15, lineHeight: 1.35 }}>{insight.title}</h3>
            <span style={{
              ...STYLES.chip, fontFamily: FONTS.mono, fontSize: 11,
              backgroundColor: `${confColor}18`, color: confColor, flexShrink: 0,
            }}>
              {insight.confidence}%
            </span>
          </div>
          <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>{insight.body}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <span style={{ ...STYLES.chip, fontSize: 11, fontFamily: FONTS.mono, backgroundColor: tag.bg, color: tag.text, border: `1px solid ${tag.border}`, letterSpacing: '0.04em' }}>
          {insight.tag}
        </span>
        <span style={{ fontSize: 11, color: COLORS.muted, fontFamily: FONTS.mono }}>
          {expanded ? '▲ hide' : '▼ more'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.border}`, animation: 'fadeSlideUp 0.2s ease' }}>
          <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Clinical Context</p>
          <p style={{ fontSize: 13, color: COLORS.muted, fontStyle: 'italic', lineHeight: 1.65, backgroundColor: COLORS.surfaceAlt, borderRadius: 8, padding: '10px 12px' }}>
            {insight.clinicalContext}
          </p>
        </div>
      )}
    </div>
  );
}
