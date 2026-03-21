import { useState } from 'react';
import { COLORS } from '../../constants/colors';
import { FONTS, STYLES } from '../../constants/styles';
import { MED_LIST } from '../constants';
import { conditionLabel, inputStyle } from '../helpers';
import MedPill from '../components/MedPill';

export default function ScreenMedications({ finalCondition, medications, addMed, removeMed, slideAnim }) {
  const [medInput, setMedInput]   = useState('');
  const [focused,  setFocused]    = useState(false);

  const q = medInput.trim().toLowerCase();
  const suggestions = MED_LIST.filter(name =>
    !medications.includes(name) && (!q || name.toLowerCase().includes(q))
  );

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = medInput.trim();
      if (trimmed) { addMed(trimmed); setMedInput(''); }
    }
  };

  return (
    <div style={{ animation: slideAnim }}>
      <p style={{ ...STYLES.label, marginBottom: 8 }}>
        Got it{finalCondition && finalCondition !== 'undiagnosed' ? ` — ${conditionLabel(finalCondition)}` : ''}.
      </p>
      <h1 style={{ ...STYLES.h1, fontSize: 'clamp(22px, 6vw, 28px)', marginBottom: 8 }}>
        Are you taking anything for it?
      </h1>
      <p style={{ ...STYLES.muted, marginBottom: 24 }}>
        This helps me spot timing patterns, like whether your symptoms shift around when you take some medicine.
      </p>

      {medications.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {medications.map(m => (
            <MedPill key={m} name={m} onRemove={() => removeMed(m)} />
          ))}
        </div>
      )}

      <input
        autoFocus={medications.length === 0}
        value={medInput}
        onChange={e => setMedInput(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={handleKey}
        placeholder="Type a medication, press Enter to add"
        style={{ ...inputStyle(focused), marginBottom: 16 }}
      />

      {suggestions.length > 0 && (
        <>
          <p style={{ ...STYLES.label, fontSize: 11, marginBottom: 10 }}>
            {q ? 'Matching medications' : 'Common medications'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.slice(0, 20).map(name => (
              <button
                key={name}
                onClick={() => addMed(name)}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`, borderRadius: 20,
                  padding: '7px 14px', cursor: 'pointer',
                  fontFamily: FONTS.sans, fontSize: 13, color: COLORS.text,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.teal; e.currentTarget.style.color = COLORS.teal; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.text; }}
              >
                {name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
