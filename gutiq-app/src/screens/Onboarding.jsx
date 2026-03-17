import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import StepIndicator from '../components/StepIndicator';
import { complete } from '../api/onboarding';
import { storeUser, getStoredUser } from '../api/client';
import { AGE_RANGES } from '../api/schemas';

const CONDITIONS = [
  { id: 'GERD',   color: '#e07b39', label: 'GERD / Acid Reflux',   desc: 'Frequent heartburn, regurgitation, chest discomfort' },
  { id: 'IBS',    color: '#2c7a7b', label: 'IBS',                   desc: 'Cramping, bloating, irregular bowel habits' },
  { id: 'Crohns', color: '#7c3aed', label: "Crohn's Disease",       desc: 'Chronic inflammation anywhere along the digestive tract' },
  { id: 'UC',     color: '#0369a1', label: 'Ulcerative Colitis',    desc: 'Inflammation and ulcers in the colon and rectum' },
  { id: 'Celiac', color: '#15803d', label: 'Celiac Disease',        desc: 'Gluten sensitivity causing intestinal damage' },
];

function ConditionCard({ color, label, desc, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        backgroundColor: selected ? COLORS.orangeLight : COLORS.surface,
        border: `1.5px solid ${selected ? COLORS.orange : COLORS.border}`,
        borderRadius: 14, padding: '14px 16px',
        cursor: 'pointer', marginBottom: 8,
        boxShadow: selected ? `0 0 0 3px ${COLORS.orangeLight}` : COLORS.shadow,
        transition: 'all 0.18s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text, margin: 0 }}>{label}</p>
          {desc && <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, margin: '2px 0 0', lineHeight: 1.4 }}>{desc}</p>}
        </div>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${selected ? COLORS.orange : COLORS.borderMid}`,
          backgroundColor: selected ? COLORS.orange : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}>
          {selected && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#fff' }} />}
        </div>
      </div>
    </button>
  );
}

const inputStyle = (focused) => ({
  width: '100%', boxSizing: 'border-box',
  padding: '13px 16px',
  border: `1.5px solid ${focused ? COLORS.orange : COLORS.border}`,
  borderRadius: 12,
  backgroundColor: COLORS.surface,
  fontFamily: FONTS.sans, fontSize: 15, color: COLORS.text,
  outline: 'none',
  transition: 'border-color 0.15s ease',
});

export default function Onboarding({ step, setStep, navigate }) {
  const { name, email, userId } = getStoredUser();
  const [condition,       setCondition]       = useState(null);
  const [customCondition, setCustomCondition] = useState('');
  const [customFocused,   setCustomFocused]   = useState(false);
  const [ageRange,        setAgeRange]        = useState(null);
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState(null);

  const finalCondition = condition === 'Other' ? customCondition.trim() : condition;

  const canProceed = () =>
    step === 1
      ? (condition === 'Other' ? customCondition.trim().length > 0 : !!condition)
      : !!ageRange;

  const handleNext = async () => {
    if (step < 2) { setStep(step + 1); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const goal = `Identify and manage ${finalCondition} triggers`;
      await complete(finalCondition, goal, ageRange);
      storeUser(email, userId, name, finalCondition);
      navigate('gutcheck');
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...STYLES.page }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 24px 100px' }}>

        <StepIndicator current={step} total={2} />

        {/* ── Step 1 — Who you are ── */}
        {step === 1 && (
          <div key="step1" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>Hi{name ? `, ${name}` : ''}. I'm Tiwa.</p>
            <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 24 }}>What are you managing?</h1>
            {CONDITIONS.map(c => (
              <ConditionCard
                key={c.id} {...c}
                selected={condition === c.id}
                onClick={() => setCondition(c.id)}
              />
            ))}
            <ConditionCard
              color="#6b7280"
              label="Something else"
              desc={null}
              selected={condition === 'Other'}
              onClick={() => setCondition('Other')}
            />
            {condition === 'Other' && (
              <input
                autoFocus
                value={customCondition}
                onChange={e => setCustomCondition(e.target.value)}
                onFocus={() => setCustomFocused(true)}
                onBlur={() => setCustomFocused(false)}
                placeholder="e.g. Gastroparesis, Diverticulitis…"
                style={{ ...inputStyle(customFocused), marginTop: 4, marginBottom: 8 }}
              />
            )}
          </div>
        )}

        {/* ── Step 2 — Set yourself up ── */}
        {step === 2 && (
          <div key="step2" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>Almost there.</p>
            <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 6 }}>Help Tiwa understand your context.</h1>
            <p style={{ ...STYLES.muted, marginBottom: 28 }}>This helps personalise your insights over time.</p>

            <p style={{ ...STYLES.label, marginBottom: 10 }}>Age range</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {AGE_RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setAgeRange(r)}
                  style={{
                    padding: '10px 20px', borderRadius: 10,
                    border: `1.5px solid ${ageRange === r ? COLORS.orange : COLORS.border}`,
                    backgroundColor: ageRange === r ? COLORS.orangeLight : COLORS.surface,
                    color: ageRange === r ? COLORS.orange : COLORS.muted,
                    fontFamily: FONTS.mono, fontWeight: ageRange === r ? 600 : 400,
                    fontSize: 14, cursor: 'pointer',
                    boxShadow: COLORS.shadow,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {saveError && (
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: '#e53e3e', marginTop: 16, textAlign: 'center' }}>
            {saveError}
          </p>
        )}

        <button
          onClick={handleNext}
          disabled={!canProceed() || saving}
          style={{ ...STYLES.btnPrimary, marginTop: 24, opacity: (canProceed() && !saving) ? 1 : 0.35 }}
        >
          {saving ? 'Saving…' : step === 2 ? 'Start tracking →' : 'Continue'}
        </button>

        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{ ...STYLES.btnGhost, marginTop: 10 }}>
            ← Back
          </button>
        )}

      </div>
    </div>
  );
}
