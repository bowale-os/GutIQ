import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import StepIndicator from '../components/StepIndicator';
import { complete } from '../api/onboarding';
import { storeUser } from '../api/client';
import { AGE_RANGES } from '../api/schemas';

function SelectCard({ color, label, desc, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        backgroundColor: selected ? COLORS.orangeLight : COLORS.surface,
        border: `1.5px solid ${selected ? COLORS.orange : COLORS.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        cursor: 'pointer',
        marginBottom: 10,
        boxShadow: selected ? `0 0 0 3px ${COLORS.orangeLight}` : COLORS.shadow,
        transition: 'all 0.18s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 15, color: COLORS.text, marginBottom: 2 }}>{label}</p>
          {desc && <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, lineHeight: 1.4 }}>{desc}</p>}
        </div>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${selected ? COLORS.orange : COLORS.borderMid}`,
          backgroundColor: selected ? COLORS.orange : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}>
          {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fff' }} />}
        </div>
      </div>
    </button>
  );
}

const CONDITIONS = [
  { id: 'GERD',        color: '#e07b39', label: 'GERD / Acid Reflux',      desc: 'Frequent heartburn, regurgitation, chest discomfort' },
  { id: 'IBS',         color: '#2c7a7b', label: 'IBS',                      desc: 'Cramping, bloating, irregular bowel habits' },
  { id: 'Ulcer',       color: '#b45309', label: 'Peptic Ulcer',             desc: 'Burning stomach pain, nausea, sensitivity to food' },
  { id: 'Crohns',      color: '#7c3aed', label: "Crohn's Disease",          desc: 'Chronic inflammation anywhere along the digestive tract' },
  { id: 'UC',          color: '#0369a1', label: 'Ulcerative Colitis',       desc: 'Inflammation and ulcers in the colon and rectum' },
  { id: 'Celiac',      color: '#15803d', label: 'Celiac Disease',           desc: 'Gluten sensitivity causing intestinal damage' },
  { id: 'Gastroparesis', color: '#9f1239', label: 'Gastroparesis',          desc: 'Delayed stomach emptying, nausea, early fullness' },
  { id: 'Dyspepsia',   color: '#92400e', label: 'Functional Dyspepsia',     desc: 'Chronic indigestion, bloating, discomfort after eating' },
  { id: 'Other',       color: '#6b7280', label: 'Other / General',          desc: 'General digestive discomfort or exploration' },
];

const LOG_PREFS = [
  { id: 'voice', icon: '🎙️', label: 'Voice',  desc: 'Speak naturally after meals. Tiwa listens and parses.' },
  { id: 'text',  icon: '⌨️', label: 'Text',   desc: 'Type a quick note. Fast and familiar.' },
  { id: 'both',  icon: '✨', label: 'Both',   desc: 'Voice when convenient, text when quiet.' },
];

const REMINDER_TIMES = [
  { id: 'morning', label: 'Morning', time: '8:00 am' },
  { id: 'lunch',   label: 'Lunch',   time: '1:00 pm' },
  { id: 'evening', label: 'Evening', time: '8:00 pm' },
  { id: 'none',    label: 'No reminders', time: '' },
];

export default function Onboarding({ step, setStep, navigate }) {
  const [condition,     setCondition]    = useState(null);
  const [logPref,       setLogPref]      = useState(null);
  const [reminderTime,  setReminderTime] = useState('evening');
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [ageRange,      setAgeRange]     = useState(null);
  const [saving,        setSaving]       = useState(false);
  const [saveError,     setSaveError]    = useState(null);

  const canProceed = () =>
    step === 1 ? !!condition :
    step === 2 ? !!logPref :
    !!ageRange;

  const handleNext = async () => {
    if (step < 3) { setStep(step + 1); return; }
    // Step 3 finish — save to backend
    setSaving(true);
    setSaveError(null);
    try {
      const goal = `Identify and manage ${condition} triggers`;
      await complete(condition, goal, ageRange);
      storeUser(localStorage.getItem('gutiq_email') || '', localStorage.getItem('gutiq_user_id') || '', condition);
      navigate('dashboard');
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...STYLES.page }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 24px 100px' }}>

        <StepIndicator current={step} total={3} />

        {/* Step 1 */}
        {step === 1 && (
          <div key="step1" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 6 }}>What are you managing?</h1>
            <p style={{ ...STYLES.muted, marginBottom: 24 }}>GutIQ personalises insights to your condition.</p>
            {CONDITIONS.map(c => (
              <SelectCard key={c.id} {...c} selected={condition === c.id} onClick={() => setCondition(c.id)} />
            ))}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div key="step2" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 6 }}>How do you want to log?</h1>
            <p style={{ ...STYLES.muted, marginBottom: 24 }}>You can switch anytime in settings.</p>
            {LOG_PREFS.map(p => (
              <SelectCard key={p.id} {...p} selected={logPref === p.id} onClick={() => setLogPref(p.id)} />
            ))}
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div key="step3" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 6 }}>When should we nudge you?</h1>
            <p style={{ ...STYLES.muted, marginBottom: 24 }}>One daily reminder builds the habit.</p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
              {REMINDER_TIMES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setReminderTime(r.id)}
                  style={{
                    padding: '10px 18px', borderRadius: 10,
                    border: `1.5px solid ${reminderTime === r.id ? COLORS.orange : COLORS.border}`,
                    backgroundColor: reminderTime === r.id ? COLORS.orangeLight : COLORS.surface,
                    color: reminderTime === r.id ? COLORS.orange : COLORS.muted,
                    fontFamily: FONTS.sans, fontWeight: reminderTime === r.id ? 600 : 400,
                    fontSize: 14, cursor: 'pointer',
                    boxShadow: COLORS.shadow,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r.label}
                  {r.time && <span style={{ display: 'block', fontFamily: FONTS.mono, fontSize: 10, opacity: 0.6, marginTop: 2 }}>{r.time}</span>}
                </button>
              ))}
            </div>

            {/* Age range */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ ...STYLES.label, marginBottom: 10 }}>Your age range</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AGE_RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => setAgeRange(r)}
                    style={{
                      padding: '10px 18px', borderRadius: 10,
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

            {/* Weekly summary toggle */}
            <div style={{ ...STYLES.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <p style={{ fontFamily: FONTS.sans, fontWeight: 500, fontSize: 14, color: COLORS.text, marginBottom: 2 }}>Weekly summary</p>
                <p style={{ fontSize: 12, color: COLORS.muted }}>Every Sunday — your week at a glance</p>
              </div>
              <button
                onClick={() => setWeeklySummary(v => !v)}
                style={{
                  width: 48, height: 26, borderRadius: 999,
                  backgroundColor: weeklySummary ? COLORS.teal : COLORS.surfaceAlt,
                  border: 'none', cursor: 'pointer',
                  position: 'relative', transition: 'background-color 0.2s ease', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: weeklySummary ? 25 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  backgroundColor: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s ease',
                }} />
              </button>
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
          {saving ? 'Saving...' : step === 3 ? 'Start tracking →' : 'Continue'}
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
