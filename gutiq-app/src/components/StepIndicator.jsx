import { COLORS } from '../constants/colors';
import { FONTS } from '../constants/styles';

export default function StepIndicator({ current, total }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              backgroundColor: i < current ? COLORS.orange : COLORS.border,
              transition: 'background-color 0.4s ease',
              boxShadow: i < current ? `0 0 6px ${COLORS.orange}88` : 'none',
            }}
          />
        ))}
      </div>
      <p style={{
        fontFamily: FONTS.mono,
        fontSize: 11,
        color: COLORS.muted,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        Step {current} of {total}
      </p>
    </div>
  );
}
