import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/styles';

export default function ConditionRow({ color, label, onClick, delay = 0 }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        backgroundColor: COLORS.surface,
        border: `1.5px solid ${COLORS.border}`,
        borderRadius: 14, padding: '13px 16px',
        cursor: 'pointer', marginBottom: 8,
        transition: 'all 0.15s ease',
        animation: `fadeSlideUp 0.22s ease ${delay}ms both`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.orange; e.currentTarget.style.backgroundColor = COLORS.orangeLight; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.backgroundColor = COLORS.surface; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
        <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text, margin: 0 }}>{label}</p>
      </div>
    </button>
  );
}
