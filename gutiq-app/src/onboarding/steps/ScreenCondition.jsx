import { useState } from 'react';
import { COLORS } from '../../constants/colors';
import { FONTS, STYLES } from '../../constants/styles';
import { CONDITIONS, CONDITIONS_DEFAULT } from '../constants';
import { inputStyle } from '../helpers';
import ConditionRow from '../components/ConditionRow';

export default function ScreenCondition({ displayName, conditionQuery, setConditionQuery, onSelect, slideAnim }) {
  const [focused, setFocused] = useState(false);

  const q = conditionQuery.trim().toLowerCase();

  // Score each condition against the query. Higher = better match.
  // Label starts-with > alias exact > label contains > alias contains.
  function score(c) {
    if (!q) return 0;
    const label = c.label.toLowerCase();
    if (label.startsWith(q))                             return 4;
    if ((c.aliases || []).some(a => a === q))            return 3;
    if (label.includes(q))                               return 2;
    if ((c.aliases || []).some(a => a.includes(q)))      return 1;
    return 0;
  }

  const filtered = q
    ? CONDITIONS.map(c => ({ c, s: score(c) }))
        .filter(({ s }) => s > 0)
        .sort((a, b) => b.s - a.s)
        .map(({ c }) => c)
    : CONDITIONS_DEFAULT;

  const showCustom = q.length >= 2 && filtered.length === 0;

  return (
    <div style={{ animation: slideAnim }}>
      <p style={{ ...STYLES.label, marginBottom: 8 }}>
        {displayName ? `Hi ${displayName}.` : 'Hi.'}
      </p>
      <h1 style={{ ...STYLES.h1, fontSize: 'clamp(22px, 6vw, 28px)', marginBottom: 6 }}>
        What are you managing?
      </h1>
      <p style={{ ...STYLES.muted, marginBottom: 16 }}>
        This influences everything. From how I read your logs, to what I look for, to how I talk to you.
      </p>

      <input
        autoFocus
        value={conditionQuery}
        onChange={e => setConditionQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="You can search here..."
        style={{ ...inputStyle(focused), marginBottom: 12 }}
      />

      <div style={{ marginBottom: 4 }}>
        {filtered.map((c, i) => (
          <ConditionRow
            key={c.id} {...c}
            delay={q ? 0 : i * 30}
            onClick={() => onSelect(c.id)}
          />
        ))}
        {showCustom && (
          <ConditionRow
            color="#6b7280"
            label={`Use "${conditionQuery.trim()}"`}
            delay={0}
            onClick={() => onSelect('custom', conditionQuery.trim())}
          />
        )}
        {q && filtered.length === 0 && !showCustom && (
          <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, padding: '8px 0' }}>
            No matches. Try a different spelling.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px' }}>
        <div style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
        <span style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.mutedLight }}>or</span>
        <div style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
      </div>

      <button
        onClick={() => onSelect('undiagnosed')}
        style={{
          width: '100%', textAlign: 'left',
          background: 'none',
          border: `1.5px dashed ${COLORS.border}`,
          borderRadius: 14, padding: '14px 16px',
          cursor: 'pointer', transition: 'border-color 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.muted}
        onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}
      >
        <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.muted, margin: 0 }}>
          I'm not diagnosed yet
        </p>
        <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.mutedLight, margin: '3px 0 0' }}>
          You have symptoms but no diagnosis. Tiwa still works.
        </p>
      </button>
    </div>
  );
}
