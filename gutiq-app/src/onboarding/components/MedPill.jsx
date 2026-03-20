import { X } from 'lucide-react';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/styles';

export default function MedPill({ name, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      backgroundColor: `${COLORS.teal}15`,
      border: `1px solid ${COLORS.teal}40`,
      borderRadius: 8, padding: '5px 10px',
      fontFamily: FONTS.sans, fontSize: 13, color: COLORS.teal,
    }}>
      {name}
      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: COLORS.teal, display: 'flex', alignItems: 'center' }}
      >
        <X size={12} />
      </button>
    </span>
  );
}
