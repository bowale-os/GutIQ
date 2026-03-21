import { useState } from 'react';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/styles';

export default function ProtocolRow({ id, label, desc, selected, onClick, customProtocol, onCustomChange }) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <button
        onClick={onClick}
        style={{
          width: '100%', textAlign: 'left',
          backgroundColor: selected ? COLORS.orangeLight : COLORS.surface,
          border: `1.5px solid ${selected ? COLORS.orange : COLORS.border}`,
          borderRadius: 12, padding: '12px 16px',
          cursor: 'pointer', marginBottom: 6,
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
            border: `2px solid ${selected ? COLORS.orange : COLORS.borderMid}`,
            backgroundColor: selected ? COLORS.orange : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}>
            {selected && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#fff' }} />}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text, margin: 0 }}>{label}</p>
            {desc && <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, margin: '3px 0 0', lineHeight: 1.4 }}>{desc}</p>}
          </div>
        </div>
      </button>
      {selected && id === 'other' && (
        <input
          autoFocus
          value={customProtocol}
          onChange={onCustomChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Describe your eating approach"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '11px 14px', marginBottom: 6,
            border: `1.5px solid ${focused ? COLORS.orange : COLORS.border}`,
            borderRadius: 10, backgroundColor: COLORS.surface,
            fontFamily: FONTS.sans, fontSize: 14, color: COLORS.text,
            outline: 'none', transition: 'border-color 0.15s ease',
          }}
        />
      )}
    </div>
  );
}
