import { COLORS, getSeverityColor } from '../constants/colors';
import { FONTS } from '../constants/styles';

export default function SeverityBar({ value, showLabel, compact }) {
  const color = getSeverityColor(value);
  const pct   = (value / 10) * 100;
  const h     = compact ? 5 : 8;

  return (
    <div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Pain level</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600, color }}>{value}/10</span>
        </div>
      )}
      <div style={{ height: h, borderRadius: 999, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          backgroundColor: color, borderRadius: 999,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}
