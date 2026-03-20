import { COLORS } from '../../constants/colors';

export default function DotIndicator({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i < current ? COLORS.teal : i === current ? COLORS.orange : COLORS.border,
            transition: 'all 0.25s ease',
          }}
        />
      ))}
    </div>
  );
}
