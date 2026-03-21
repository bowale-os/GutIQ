import { ChevronLeft } from 'lucide-react';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/styles';

export default function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '4px 0', marginBottom: 20,
        fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted,
        transition: 'color 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.color = COLORS.text}
      onMouseLeave={e => e.currentTarget.style.color = COLORS.muted}
    >
      <ChevronLeft size={16} />
      Back
    </button>
  );
}
