import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/styles';

export default function ChannelButton({ icon: Icon, title, desc, selected, onClick, accent }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        backgroundColor: selected ? `${accent}12` : COLORS.surface,
        border: `1.5px solid ${selected ? accent : COLORS.border}`,
        borderRadius: 14, padding: '14px 16px',
        cursor: 'pointer', marginBottom: 8,
        transition: 'all 0.18s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          backgroundColor: selected ? `${accent}20` : COLORS.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={selected ? accent : COLORS.muted} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text, margin: 0 }}>{title}</p>
          <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, margin: '2px 0 0' }}>{desc}</p>
        </div>
      </div>
    </button>
  );
}
